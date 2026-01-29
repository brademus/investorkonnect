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
        const investorRecipient = recipients.find(r => r.recipientId === agreement.investor_recipient_id);
        const agentRecipient = recipients.find(r => r.recipientId === agreement.agent_recipient_id);
        
        const investorSigned = investorRecipient?.status === 'completed';
        const agentSigned = agentRecipient?.status === 'completed';
        
        if (investorSigned && !agreement.investor_signed_at) {
          updates.investor_signed_at = new Date().toISOString();
        }
        
        if (agentSigned && !agreement.agent_signed_at) {
          updates.agent_signed_at = new Date().toISOString();
        }
        
        // Determine status
        if (investorSigned && agentSigned) {
          // Both signed - check if NJ for attorney review
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
            
            console.log('[DocuSign Webhook] Signed PDF uploaded:', uploadResponse.file_url);
          } catch (error) {
            console.error('[DocuSign Webhook] Failed to download/upload signed PDF:', error);
          }

          // Multi-agent lock-in: update DealInvite and void others
          if (agreement.room_id) {
            try {
              // Find the invite for this agreement
              const invites = await base44.asServiceRole.entities.DealInvite.filter({
                legal_agreement_id: agreement.id
              });
              
              if (invites && invites.length > 0) {
                const winningInvite = invites[0];
                
                // Mark this invite as LOCKED
                await base44.asServiceRole.entities.DealInvite.update(winningInvite.id, {
                  status: 'LOCKED'
                });
                
                // Lock the deal
                await base44.asServiceRole.entities.Deal.update(agreement.deal_id, {
                  locked_agent_profile_id: winningInvite.agent_profile_id,
                  locked_room_id: agreement.room_id,
                  connected_at: new Date().toISOString()
                });
                
                // Mark winning room as locked
                await base44.asServiceRole.entities.Room.update(agreement.room_id, {
                  request_status: 'locked',
                  agreement_status: 'fully_signed',
                  signed_at: new Date().toISOString()
                });
                
                console.log('[DocuSign Webhook] ✓ Locked deal to agent:', winningInvite.agent_profile_id);
                
                // Void all other invites
                const allInvites = await base44.asServiceRole.entities.DealInvite.filter({
                  deal_id: agreement.deal_id
                });
                
                for (const invite of allInvites) {
                  if (invite.id !== winningInvite.id) {
                    await base44.asServiceRole.entities.DealInvite.update(invite.id, {
                      status: 'EXPIRED'
                    });
                    
                    // Void the agreement
                    if (invite.legal_agreement_id) {
                      await base44.asServiceRole.entities.LegalAgreement.update(invite.legal_agreement_id, {
                        status: 'voided',
                        docusign_status: 'voided'
                      });
                    }
                    
                    // Expire the room
                    if (invite.room_id) {
                      await base44.asServiceRole.entities.Room.update(invite.room_id, {
                        request_status: 'expired',
                        agreement_status: 'voided'
                      });
                    }
                  }
                }
                
                console.log('[DocuSign Webhook] ✓ Voided', allInvites.length - 1, 'other invites');
              }
            } catch (e) {
              console.error('[DocuSign Webhook] Failed to handle lock-in:', e);
            }
          }
          
          // PHASE 7: Also update Room.current_legal_agreement_id
          if (agreement.room_id && agreement.id) {
            try {
              await base44.asServiceRole.entities.Room.update(agreement.room_id, {
                current_legal_agreement_id: agreement.id
              });
              console.log('[DocuSign Webhook] ✓ Updated Room.current_legal_agreement_id');
            } catch (e) {
              console.warn('[DocuSign Webhook] Failed to update Room.current_legal_agreement_id:', e?.message);
            }
          }
        } else if (investorSigned && !agreement.investor_signed_at) {
          updates.status = 'investor_signed';
          
          // After investor signs, create invites for all selected agents
          if (!agreement.room_id) {
            // This is the initial "base" agreement - create invites
            try {
              await base44.functions.invoke('createInvitesAfterInvestorSign', { 
                deal_id: agreement.deal_id 
              });
              console.log('[DocuSign Webhook] ✓ Created invites after investor signature');
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

    // Persist signed agreement into Deal.documents so Shared Files can show it immediately
    try {
      const finalStatus = updates.status || agreement.status;
      if ((finalStatus === 'fully_signed' || finalStatus === 'attorney_review_pending') && (updates.signed_pdf_url || agreement.signed_pdf_url)) {
        const nowIso = new Date().toISOString();
        const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
        const existingDeal = dealArr[0] || {};
        const existingDocs = existingDeal.documents || {};
        const signedUrl = updates.signed_pdf_url || agreement.signed_pdf_url;
        const docMeta = {
          url: signedUrl,
          name: 'Internal Agreement (Signed).pdf',
          type: 'application/pdf',
          uploaded_at: nowIso,
          verified: true
        };
        const newDocs = {
          ...existingDocs,
          operating_agreement: docMeta,
          internal_agreement: docMeta
        };
        await base44.asServiceRole.entities.Deal.update(agreement.deal_id, { documents: newDocs, is_fully_signed: true });
        console.log('[DocuSign Webhook] ✓ Deal.documents updated with signed agreement');
      }
    } catch (e) {
      console.warn('[DocuSign Webhook] Warning: failed to persist signed agreement to Deal.documents', e?.message || e);
    }
    
    return Response.json({ received: true });
  } catch (error) {
    console.error('[DocuSign Webhook] Error:', error);
    // Return 200 to prevent DocuSign retries for processing errors AFTER signature verification.
    // Note: Signature failures are handled earlier with a 401, so reaching here implies verified request.
    return Response.json({ received: true, error: error?.message || String(error) });
  }
});