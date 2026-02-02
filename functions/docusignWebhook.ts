import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createClient } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected');
  }
  const connection = connections[0];
  const now = new Date();
  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  if (expiresAt && now >= expiresAt) {
    throw new Error('DocuSign token expired');
  }
  return connection;
}

async function downloadSignedPdf(base44, envelopeId) {
  const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = await getDocuSignConnection(base44);
  const pdfUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;
  const response = await fetch(pdfUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/pdf'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to download signed PDF');
  }
  return await response.arrayBuffer();
}

async function sha256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function calculateNJReviewEnd() {
  // NJ: 3 business days from now
  let date = new Date();
  let businessDays = 0;
  
  while (businessDays < 3) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Not weekend
      businessDays++;
    }
  }
  
  // Set to end of day
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

/**
 * PHASE 3: Lock-in enforcement
 * When a room's agreement becomes fully signed, lock the deal to that agent
 * and expire all other pending invites.
 */
async function enforceDealLockIn(base44, dealId, roomId) {
  try {
    console.log('[Lock-in] Checking lock-in for deal:', dealId, 'room:', roomId);
    
    const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    if (!dealArr || dealArr.length === 0) {
      console.log('[Lock-in] Deal not found');
      return;
    }
    const deal = dealArr[0];

    // Idempotent: if already locked, do nothing
    if (deal.locked_room_id) {
      console.log('[Lock-in] Deal already locked to room:', deal.locked_room_id);
      return;
    }

    const roomArr = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    if (!roomArr || roomArr.length === 0) {
      console.log('[Lock-in] Room not found');
      return;
    }
    const room = roomArr[0];

    // Lock the deal to this room
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Deal.update(dealId, {
      locked_room_id: roomId,
      locked_agent_id: room.agentId,
      agent_id: room.agentId, // Compatibility: set main agent_id
      connected_at: now
    });
    console.log('[Lock-in] ✓ Deal locked to room:', roomId, 'agent:', room.agentId);

    // Mark winning room as locked
    await base44.asServiceRole.entities.Room.update(roomId, {
      request_status: 'locked'
    });
    console.log('[Lock-in] ✓ Winning room marked locked');

    // Expire all other rooms for this deal
    const allRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
    const losers = (allRooms || []).filter(r => r.id !== roomId);

    for (const loser of losers) {
      await base44.asServiceRole.entities.Room.update(loser.id, {
        request_status: 'expired'
      });
      console.log('[Lock-in] ✓ Expired room:', loser.id);
    }

    console.log('[Lock-in] ✓ Lock-in complete. Expired', losers.length, 'other rooms');
  } catch (error) {
    console.error('[Lock-in] Error enforcing lock-in:', error);
  }
}

/**
 * POST /api/docusign/webhook
 * Handle DocuSign Connect webhook events
 */
Deno.serve(async (req) => {
  try {
    // Verify webhook signature (HMAC SHA-256 over raw body)
    const sigHeader = req.headers.get('X-DocuSign-Signature-1')?.trim() || '';
    const webhookSecret = Deno.env.get('DOCUSIGN_WEBHOOK_SECRET')?.trim() || '';

    // Read raw body first (single-use stream)
    const rawBody = await req.arrayBuffer();

    // Require secret + header; reject if missing or invalid
    if (!webhookSecret || !sigHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, rawBody);

    // Compare against common encodings (hex or base64)
    const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const toBase64 = (buf) => {
      const bin = String.fromCharCode(...new Uint8Array(buf));
      return btoa(bin);
    };
    const computedHex = toHex(sigBytes);
    const computedB64 = toBase64(sigBytes);

    const provided = sigHeader.replace(/=/g, '').toLowerCase();
    const matches =
      provided === computedHex.toLowerCase() ||
      provided === computedB64.replace(/=+$/, '');

    if (!matches) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse JSON after verification
    const event = JSON.parse(new TextDecoder().decode(rawBody));
    console.log('[DocuSign Webhook] Event received:', event.event);
    
    const envelopeId = event.data?.envelopeId || event.envelopeId;
    if (!envelopeId) {
      console.log('[DocuSign Webhook] No envelope ID, ignoring');
      return Response.json({ received: true });
    }
    
    // Find agreement by envelope ID (check both AgreementVersion and LegalAgreement)
    const base44 = createClient(Deno.env.get('BASE44_APP_ID'), {
      serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });
    
    // Try AgreementVersion first (new system)
    let versions = await base44.asServiceRole.entities.AgreementVersion.filter({ 
      docusign_envelope_id: envelopeId 
    });
    
    if (versions && versions.length > 0) {
      // Update AgreementVersion
      const version = versions[0];
      console.log('[DocuSign Webhook] Found AgreementVersion:', version.id);
      
      const eventType = event.event || event.data?.envelopeStatus;
      console.log('[DocuSign Webhook] Processing event:', eventType, 'for version:', version.id);
      
      const updates = {
        docusign_status: eventType
      };
      
      switch (eventType) {
        case 'sent':
        case 'delivered':
          updates.status = 'awaiting_investor_signature';
          break;
          
        case 'signing_complete':
        case 'completed':
          const recipients = event.data?.envelopeRecipients || [];
          const investorRecipient = recipients.find(r => r.recipientId === version.investor_recipient_id);
          const agentRecipient = recipients.find(r => r.recipientId === version.agent_recipient_id);
          
          const investorSigned = investorRecipient?.status === 'completed';
          const agentSigned = agentRecipient?.status === 'completed';
          
          if (investorSigned && !version.investor_signed_at) {
            updates.investor_signed_at = new Date().toISOString();
          }
          
          if (agentSigned && !version.agent_signed_at) {
            updates.agent_signed_at = new Date().toISOString();
          }
          
          if (investorSigned && agentSigned) {
            updates.status = 'fully_signed';
            
            // Download signed PDF
            try {
              const pdfBuffer = await downloadSignedPdf(base44, envelopeId);
              const pdfHash = await sha256(pdfBuffer);
              
              const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
              const file = new File([blob], `agreement_${version.id}_signed.pdf`);
              const uploadResponse = await base44.integrations.Core.UploadFile({ file });
              
              updates.signed_pdf_url = uploadResponse.file_url;
              updates.pdf_sha256 = pdfHash;
              
              console.log('[DocuSign Webhook] Signed PDF uploaded:', uploadResponse.file_url);
            } catch (error) {
              console.error('[DocuSign Webhook] Failed to download/upload signed PDF:', error);
            }
          } else if (investorSigned) {
            updates.status = 'awaiting_agent_signature';
          } else if (agentSigned) {
            updates.status = 'awaiting_investor_signature';
          }
          break;
          
        case 'voided':
        case 'declined':
          updates.status = 'voided';
          break;
      }
      
      await base44.asServiceRole.entities.AgreementVersion.update(version.id, updates);
      console.log('[DocuSign Webhook] AgreementVersion updated:', version.id);
      
      // Auto-move deal to connected_deals if fully signed
      if (updates.status === 'fully_signed' && version.deal_id) {
        try {
          const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: version.deal_id });
          if (Array.isArray(dealArr) && dealArr.length > 0 && dealArr[0].pipeline_stage !== 'connected_deals') {
            await base44.asServiceRole.entities.Deal.update(version.deal_id, { pipeline_stage: 'connected_deals' });
            console.log('[DocuSign Webhook] Moved deal', version.deal_id, 'to connected_deals');
          }
        } catch (e) {
          console.warn('[DocuSign Webhook] Failed to auto-move deal to connected_deals:', e?.message || e);
        }
      }
      
      return Response.json({ received: true });
    }
    
    // Fallback to legacy LegalAgreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
      docusign_envelope_id: envelopeId 
    });
    
    if (!agreements || agreements.length === 0) {
      console.log('[DocuSign Webhook] Agreement not found for envelope:', envelopeId);
      return Response.json({ received: true });
    }
    
    const agreement = agreements[0];
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    
    // Update based on event
    const eventType = event.event || event.data?.envelopeStatus;
    console.log('[DocuSign Webhook] Processing event:', eventType, 'for agreement:', agreement.id);
    
    const updates = {
      docusign_status: eventType,
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: 'DocuSign',
          action: `webhook_${eventType}`,
          details: `DocuSign status: ${eventType}`
        }
      ]
    };
    
    // Map DocuSign events to agreement status
    switch (eventType) {
      case 'sent':
      case 'delivered':
        updates.status = 'sent';
        break;
        
      case 'signing_complete':
      case 'completed':
        // Check which recipients have signed
        const recipients = event.data?.envelopeRecipients || [];
        const signerMode = agreement.signer_mode || 'both';
        
        console.log('[DocuSign Webhook] Completion event - signer_mode:', signerMode);
        
        // Handle different signer modes
        let investorSigned = false;
        let agentSigned = false;
        
        if (signerMode === 'investor_only') {
          // Only investor recipient (recipientId 1)
          const investorRecipient = recipients.find(r => r.recipientId === '1');
          investorSigned = investorRecipient?.status === 'completed';
          
          if (investorSigned && !agreement.investor_signed_at) {
            updates.investor_signed_at = new Date().toISOString();
          }
        } else if (signerMode === 'agent_only') {
          // Only agent recipient (recipientId 1)
          const agentRecipient = recipients.find(r => r.recipientId === '1');
          agentSigned = agentRecipient?.status === 'completed';
          
          if (agentSigned && !agreement.agent_signed_at) {
            updates.agent_signed_at = new Date().toISOString();
          }
        } else {
          // Both mode: investor (recipientId 1), agent (recipientId 2)
          const investorRecipient = recipients.find(r => r.recipientId === '1');
          const agentRecipient = recipients.find(r => r.recipientId === '2');
          
          investorSigned = investorRecipient?.status === 'completed';
          agentSigned = agentRecipient?.status === 'completed';
          
          if (investorSigned && !agreement.investor_signed_at) {
            updates.investor_signed_at = new Date().toISOString();
          }
          
          if (agentSigned && !agreement.agent_signed_at) {
            updates.agent_signed_at = new Date().toISOString();
          }
        }
        
        console.log('[DocuSign Webhook] Signatures - investor:', investorSigned, 'agent:', agentSigned);
        
        // Determine status and lock-in logic based on signer_mode
        if (signerMode === 'agent_only' && agentSigned) {
          // Agent-only: agent signature LOCKS the deal (first to sign wins)
          updates.status = 'fully_signed';
          
          // Download signed PDF
          try {
            const pdfBuffer = await downloadSignedPdf(base44, envelopeId);
            const pdfHash = await sha256(pdfBuffer);
            
            const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
            const file = new File([blob], `agreement_${agreement.id}_signed.pdf`);
            const uploadResponse = await base44.integrations.Core.UploadFile({ file });
            
            updates.signed_pdf_url = uploadResponse.file_url;
            updates.signed_pdf_sha256 = pdfHash;
            
            console.log('[DocuSign Webhook] Signed PDF uploaded for agent_only:', uploadResponse.file_url);
          } catch (error) {
            console.error('[DocuSign Webhook] Failed to download/upload signed PDF:', error);
          }
          
          // LOCK THE DEAL to this agent/room
          if (agreement.room_id) {
            await enforceDealLockIn(base44, agreement.deal_id, agreement.room_id);
          }
          
        } else if (signerMode === 'investor_only' && investorSigned) {
          // Investor-only: just marks investor signed, doesn't lock deal
          updates.status = 'investor_signed';
          
          // Trigger invite creation (happens in separate block below)
          
        } else if (signerMode === 'both' && investorSigned && agentSigned) {
          // Both mode: only lock when BOTH have signed
          if (agreement.governing_state === 'NJ') {
            updates.status = 'attorney_review_pending';
            updates.nj_review_end_at = calculateNJReviewEnd();
            console.log('[DocuSign Webhook] NJ deal - entering attorney review until', updates.nj_review_end_at);
          } else {
            updates.status = 'fully_signed';
          }
          
          // Download signed PDF
          try {
            const pdfBuffer = await downloadSignedPdf(base44, envelopeId);
            const pdfHash = await sha256(pdfBuffer);
            
            // Upload to storage
            const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
            const file = new File([blob], `agreement_${agreement.id}_signed.pdf`);
            const uploadResponse = await base44.integrations.Core.UploadFile({ file });
            
            updates.signed_pdf_url = uploadResponse.file_url;
            updates.signed_pdf_sha256 = pdfHash;
            
            console.log('[DocuSign Webhook] Signed PDF uploaded (both mode):', uploadResponse.file_url);
          } catch (error) {
            console.error('[DocuSign Webhook] Failed to download/upload signed PDF:', error);
          }

          // LOCK THE DEAL when both mode is fully signed
          if (agreement.room_id) {
            await enforceDealLockIn(base44, agreement.deal_id, agreement.room_id);
          }
          
        } else if (signerMode === 'both' && investorSigned && !agentSigned) {
          updates.status = 'investor_signed';
        } else if (signerMode === 'both' && !investorSigned && agentSigned) {
          // Should not happen (agent should be gated), but handle gracefully
          updates.status = 'agent_signed';
          
          // PHASE 7: Also update Room.current_legal_agreement_id and sync agreement status
          if (agreement.room_id && agreement.id) {
            try {
              await base44.asServiceRole.entities.Room.update(agreement.room_id, {
                current_legal_agreement_id: agreement.id,
                agreement_status: 'fully_signed',
                request_status: 'signed',
                signed_at: new Date().toISOString(),
                is_fully_signed: true,
                requires_regenerate: false // Clear regenerate flag on full signature
              });
              console.log('[DocuSign Webhook] ✓ Updated Room to fully_signed status');
            } catch (e) {
              console.warn('[DocuSign Webhook] Failed to update Room status:', e?.message);
            }
          }
        } else if (investorSigned && !agreement.investor_signed_at) {
          updates.status = 'investor_signed';
          
          // CRITICAL: Clear requires_regenerate flag when investor signs regenerated agreement
          if (agreement.room_id) {
            try {
              await base44.asServiceRole.entities.Room.update(agreement.room_id, {
                requires_regenerate: false,
                agreement_status: 'investor_signed'
              });
              console.log('[DocuSign Webhook] ✓ Cleared requires_regenerate flag on room:', agreement.room_id);

              // CRITICAL: Mark all accepted counters for this room as 'completed' to hide from UI
              const acceptedCounters = await base44.asServiceRole.entities.CounterOffer.filter({
                room_id: agreement.room_id,
                status: 'accepted'
              });

              for (const counter of acceptedCounters || []) {
                await base44.asServiceRole.entities.CounterOffer.update(counter.id, {
                  status: 'completed',
                  responded_at: new Date().toISOString()
                });
              }
              console.log('[DocuSign Webhook] ✓ Marked', (acceptedCounters || []).length, 'accepted counters as completed');

              // ALSO mark all superseded counters as completed to clean up
              const supersededCounters = await base44.asServiceRole.entities.CounterOffer.filter({
                room_id: agreement.room_id,
                status: 'superseded'
              });

              for (const counter of supersededCounters || []) {
                await base44.asServiceRole.entities.CounterOffer.update(counter.id, {
                  status: 'completed'
                });
              }
              console.log('[DocuSign Webhook] ✓ Marked', (supersededCounters || []).length, 'superseded counters as completed');
            } catch (e) {
              console.warn('[DocuSign Webhook] Failed to clear requires_regenerate:', e?.message);
            }
          }
          
          // After investor signs investor_only agreement, trigger invite creation
          if (signerMode === 'investor_only' && !agreement.room_id) {
            // This is the base agreement - create invites for all agents
            try {
              // Get deal with selected agent IDs
              const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
              const deal = deals[0];
              const selectedAgentIds = deal?.metadata?.selected_agent_ids || [];
              
              if (selectedAgentIds.length > 0) {
                console.log('[DocuSign Webhook] Creating invites for', selectedAgentIds.length, 'agents');
                
                // Check if invites already exist (idempotency)
                const existingInvites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id: deal.id });
                
                if (existingInvites.length === 0) {
                  // Get investor profile
                  const profiles = await base44.asServiceRole.entities.Profile.filter({ id: deal.investor_id });
                  const investorProfile = profiles[0];
                  
                  if (investorProfile) {
                    // Prepare exhibit_a for agreements
                    const exhibit_a = {
                      transaction_type: 'ASSIGNMENT',
                      compensation_model: deal.proposed_terms?.seller_commission_type === 'percentage' ? 'COMMISSION_PCT' : 'FLAT_FEE',
                      commission_percentage: deal.proposed_terms?.seller_commission_percentage || 3,
                      flat_fee_amount: deal.proposed_terms?.seller_flat_fee || 5000,
                      buyer_commission_type: deal.proposed_terms?.buyer_commission_type || 'percentage',
                      buyer_commission_percentage: deal.proposed_terms?.buyer_commission_percentage || 3,
                      buyer_flat_fee: deal.proposed_terms?.buyer_flat_fee || 5000,
                      agreement_length_days: deal.proposed_terms?.agreement_length || 180,
                      exclusive_agreement: true
                    };
                    
                    // Create invite for each agent
                    for (const agentId of selectedAgentIds) {
                     try {
                       // 1. Create Room for this agent - ACCEPTED status (investor already signed)
                       const room = await base44.asServiceRole.entities.Room.create({
                         deal_id: deal.id,
                         investorId: investorProfile.id,
                         agentId: agentId,
                         request_status: 'accepted', // IMPORTANT: accepted, not requested
                         agreement_status: 'sent', // Agent can sign
                         title: deal.title,
                         property_address: deal.property_address,
                         city: deal.city,
                         state: deal.state,
                         county: deal.county,
                         zip: deal.zip,
                         budget: deal.purchase_price,
                         closing_date: deal.key_dates?.closing_date,
                         proposed_terms: deal.proposed_terms,
                         requested_at: new Date().toISOString(),
                         accepted_at: new Date().toISOString()
                       });

                       console.log('[DocuSign Webhook] Created room:', room.id, 'for agent:', agentId);

                       // 2. Generate agent-only agreement
                       const genRes = await base44.functions.invoke('generateLegalAgreement', {
                         deal_id: deal.id,
                         room_id: room.id,
                         signer_mode: 'agent_only',
                         source_base_agreement_id: agreement.id,
                         exhibit_a
                       });
                        
                        if (genRes.data?.success) {
                          const newAgreement = genRes.data.agreement;
                          
                          // 3. Update room with agreement ID
                          await base44.asServiceRole.entities.Room.update(room.id, {
                            current_legal_agreement_id: newAgreement.id,
                            agreement_status: 'sent'
                          });
                          
                          // 4. Create DealInvite
                          await base44.asServiceRole.entities.DealInvite.create({
                            deal_id: deal.id,
                            investor_id: investorProfile.id,
                            agent_profile_id: agentId,
                            room_id: room.id,
                            legal_agreement_id: newAgreement.id,
                            status: 'PENDING_AGENT_SIGNATURE',
                            created_at_iso: new Date().toISOString()
                          });
                          
                          console.log('[DocuSign Webhook] Created invite for agent:', agentId);
                        }
                      } catch (error) {
                        console.error('[DocuSign Webhook] Failed to create invite for agent', agentId, ':', error);
                      }
                    }
                    
                    console.log('[DocuSign Webhook] ✓ Created invites after investor signature');
                  }
                } else {
                  console.log('[DocuSign Webhook] Invites already exist, skipping');
                }
              }
            } catch (e) {
              console.warn('[DocuSign Webhook] Failed to create invites:', e?.message || e);
            }
          }
        } else if (agentSigned) {
          updates.status = 'agent_signed';
        }
        break;
        
      case 'voided':
      case 'declined':
        updates.status = 'draft';
        updates.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'DocuSign',
          action: 'envelope_voided',
          details: `Envelope ${eventType} - can regenerate`
        });
        break;
    }
    
    // Update agreement
    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
    console.log('[DocuSign Webhook] Agreement updated:', agreement.id);
    
    // Auto-move deal to connected_deals if fully signed
    const finalStatus = updates.status || agreement.status;
    if (finalStatus === 'fully_signed' || finalStatus === 'attorney_review_pending') {
      try {
        const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
        if (dealArr && dealArr.length > 0 && dealArr[0].pipeline_stage !== 'connected_deals') {
          await base44.asServiceRole.entities.Deal.update(agreement.deal_id, { pipeline_stage: 'connected_deals' });
          console.log('[DocuSign Webhook] Moved deal', agreement.deal_id, 'to connected_deals');
        }
      } catch (e) {
        console.warn('[DocuSign Webhook] Failed to auto-move deal to connected_deals:', e?.message || e);
      }
    }
    
    // Update ALL Rooms for this deal to ensure status is synced
    try {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: agreement.deal_id });
      if (rooms && rooms.length > 0) {
        const finalStatus = updates.status || agreement.status;
        for (const room of rooms) {
          const roomUpdates = { agreement_status: finalStatus };
          
          // If fully signed, update request_status too
          if (finalStatus === 'fully_signed' || finalStatus === 'attorney_review_pending') {
            roomUpdates.request_status = 'signed';
          }
          
          await base44.asServiceRole.entities.Room.update(room.id, roomUpdates);
        }
        console.log('[DocuSign Webhook] ✓ Updated', rooms.length, 'room(s) with status:', finalStatus);
      }
    } catch (e) {
      console.warn('[DocuSign Webhook] Warning: failed to update Room agreement_status', e?.message || e);
    }

    // Persist signed agreement into BOTH Deal.documents AND Room.internal_agreement_document
    try {
      const finalStatus = updates.status || agreement.status;
      if ((finalStatus === 'fully_signed' || finalStatus === 'attorney_review_pending') && (updates.signed_pdf_url || agreement.signed_pdf_url)) {
        const nowIso = new Date().toISOString();
        const signedUrl = updates.signed_pdf_url || agreement.signed_pdf_url;
        const docMeta = {
          url: signedUrl,
          signed_pdf_url: signedUrl,
          name: 'Internal Agreement (Signed).pdf',
          type: 'application/pdf',
          uploaded_at: nowIso,
          verified: true,
          uploaded_by_name: 'System'
        };
        
        // Update Deal.documents
        const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
        const existingDeal = dealArr[0] || {};
        const existingDocs = existingDeal.documents || {};
        const newDocs = {
          ...existingDocs,
          operating_agreement: docMeta,
          internal_agreement: docMeta
        };
        await base44.asServiceRole.entities.Deal.update(agreement.deal_id, { documents: newDocs, is_fully_signed: true });
        console.log('[DocuSign Webhook] ✓ Deal.documents updated with signed agreement');
        
        // ALSO update Room.internal_agreement_document for room-scoped visibility
        if (agreement.room_id) {
          await base44.asServiceRole.entities.Room.update(agreement.room_id, {
            internal_agreement_document: docMeta
          });
          console.log('[DocuSign Webhook] ✓ Room.internal_agreement_document updated');
        }
      }
    } catch (e) {
      console.warn('[DocuSign Webhook] Warning: failed to persist signed agreement to documents', e?.message || e);
    }
    
    return Response.json({ received: true });
  } catch (error) {
    console.error('[DocuSign Webhook] Error:', error);
    // Return 200 to prevent DocuSign retries for processing errors AFTER signature verification.
    // Note: Signature failures are handled earlier with a 401, so reaching here implies verified request.
    return Response.json({ received: true, error: error?.message || String(error) });
  }
});