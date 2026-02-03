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
        
        // CRITICAL: Check if this is an agent signing a shared base agreement (first-to-sign-wins)
        // This happens when ANY agent signs the investor_only base agreement via their room
        const isAgentSigningBaseAgreement = (
          signerMode === 'investor_only' && 
          agentSigned && 
          agreement.room_id // Room-specific signing of base agreement
        );
        
        if (isAgentSigningBaseAgreement) {
          console.log('[DocuSign Webhook] AGENT SIGNED BASE AGREEMENT - First-to-sign-wins!');
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
            updates.agent_signed_at = new Date().toISOString();
            
            console.log('[DocuSign Webhook] Signed PDF uploaded:', uploadResponse.file_url);
          } catch (error) {
            console.error('[DocuSign Webhook] Failed to download/upload signed PDF:', error);
          }
          
          // LOCK THE DEAL to this agent/room
          await enforceDealLockIn(base44, agreement.deal_id, agreement.room_id);
          
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
          // Agent signed first in counter-accepted agreement (should wait for investor)
          updates.status = 'agent_signed';
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
          
          // CRITICAL: After investor signs base agreement, create Deal from DealDraft if needed
          if (signerMode === 'investor_only' && !agreement.room_id && !agreement.deal_id) {
            try {
              console.log('[DocuSign Webhook] Creating Deal from DealDraft after investor signature');
              
              // Find DealDraft by investor_profile_id (most recent)
              const drafts = await base44.asServiceRole.entities.DealDraft.filter({
                investor_profile_id: agreement.investor_profile_id
              });
              
              if (drafts && drafts.length > 0) {
                const draft = drafts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
                
                // Create Deal from DealDraft
                const newDeal = await base44.asServiceRole.entities.Deal.create({
                  title: draft.property_address,
                  property_address: draft.property_address,
                  city: draft.city,
                  state: draft.state,
                  zip: draft.zip,
                  county: draft.county,
                  purchase_price: draft.purchase_price,
                  property_type: draft.property_type,
                  property_details: {
                    beds: draft.beds,
                    baths: draft.baths,
                    sqft: draft.sqft,
                    year_built: draft.year_built,
                    number_of_stories: draft.number_of_stories,
                    has_basement: draft.has_basement
                  },
                  seller_info: {
                    seller_name: draft.seller_name,
                    earnest_money: draft.earnest_money,
                    number_of_signers: draft.number_of_signers,
                    second_signer_name: draft.second_signer_name
                  },
                  proposed_terms: {
                    buyer_commission_type: draft.buyer_commission_type,
                    buyer_commission_percentage: draft.buyer_commission_percentage,
                    buyer_flat_fee: draft.buyer_flat_fee,
                    agreement_length: draft.agreement_length
                  },
                  status: 'active',
                  pipeline_stage: 'new_deals',
                  investor_id: draft.investor_profile_id,
                  selected_agent_ids: draft.selected_agent_ids || [],
                  current_legal_agreement_id: agreement.id
                });
                
                console.log('[DocuSign Webhook] ✓ Created Deal:', newDeal.id);
                
                // Link agreement to deal
                await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, {
                  deal_id: newDeal.id
                });
                
                // Create rooms + invites for selected agents
                await base44.functions.invoke('createInvitesAfterInvestorSign', {
                  deal_id: newDeal.id
                });
                
                console.log('[DocuSign Webhook] ✓ Invites created for', draft.selected_agent_ids?.length || 0, 'agents');
                
                // Delete DealDraft
                await base44.asServiceRole.entities.DealDraft.delete(draft.id);
                console.log('[DocuSign Webhook] ✓ Deleted DealDraft');
              }
            } catch (e) {
              console.error('[DocuSign Webhook] Failed to create Deal from DealDraft:', e?.message || e);
            }
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