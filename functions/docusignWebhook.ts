import { createClient } from 'npm:@base44/sdk@0.8.6';

const VERSION = '5.0.0';

async function getDocuSignConnection(base44) {
  const conns = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!conns?.length) throw new Error('DocuSign not connected');
  const conn = conns[0];
  if (conn.expires_at && new Date() >= new Date(conn.expires_at)) throw new Error('DocuSign token expired');
  return conn;
}

async function downloadAndUploadSignedPdf(base44, envelopeId, agreementId) {
  const conn = await getDocuSignConnection(base44);
  const resp = await fetch(`${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${envelopeId}/documents/combined`, {
    headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Accept': 'application/pdf' }
  });
  if (!resp.ok) throw new Error('Failed to download signed PDF');
  const buf = await resp.arrayBuffer();
  const blob = new Blob([buf], { type: 'application/pdf' });
  const file = new File([blob], `agreement_${agreementId}_signed.pdf`);
  const upload = await base44.integrations.Core.UploadFile({ file });
  return upload.file_url;
}

async function lockDeal(base44, dealId, roomId) {
  const [dealArr, roomArr] = await Promise.all([
    base44.asServiceRole.entities.Deal.filter({ id: dealId }),
    base44.asServiceRole.entities.Room.filter({ id: roomId })
  ]);
  const deal = dealArr?.[0];
  const room = roomArr?.[0];
  if (!deal || !room) return;
  if (deal.locked_room_id) return; // Already locked

  const now = new Date().toISOString();
  await base44.asServiceRole.entities.Deal.update(dealId, {
    locked_room_id: roomId, locked_agent_id: room.agent_ids?.[0] || room.agentId,
    agent_id: room.agent_ids?.[0] || room.agentId, connected_at: now,
    pipeline_stage: 'connected_deals', is_fully_signed: true
  });
  await base44.asServiceRole.entities.Room.update(roomId, { request_status: 'locked', agreement_status: 'fully_signed' });

  // Expire other rooms
  const allRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
  for (const r of (allRooms || []).filter(r => r.id !== roomId)) {
    await base44.asServiceRole.entities.Room.update(r.id, { request_status: 'expired' });
  }
  console.log(`[webhook] Deal ${dealId} locked to room ${roomId}`);
}

Deno.serve(async (req) => {
  // Verify HMAC signature
  const sigHeader = req.headers.get('X-DocuSign-Signature-1')?.trim() || '';
  const secret = Deno.env.get('DOCUSIGN_WEBHOOK_SECRET')?.trim() || '';
  const rawBody = await req.arrayBuffer();

  if (!secret || !sigHeader) return new Response('Unauthorized', { status: 401 });

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBytes = await crypto.subtle.sign('HMAC', key, rawBody);
  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  if (sigHeader.replace(/=/g, '') !== computedB64.replace(/=+$/, '')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const event = JSON.parse(new TextDecoder().decode(rawBody));
    const envelopeId = event.data?.envelopeId || event.envelopeId;
    if (!envelopeId) return Response.json({ received: true });

    const base44 = createClient(Deno.env.get('BASE44_APP_ID'), { serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY') });

    // Find agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ docusign_envelope_id: envelopeId });
    if (!agreements?.length) {
      console.log(`[webhook ${VERSION}] No agreement for envelope ${envelopeId}`);
      return Response.json({ received: true });
    }
    const agreement = agreements[0];
    const eventType = event.event || event.data?.envelopeStatus;
    const recipients = event.data?.envelopeRecipients || [];
    const mode = agreement.signer_mode || 'both';

    console.log(`[webhook ${VERSION}] ${eventType} for agreement ${agreement.id} mode=${mode}`);

    const updates = { docusign_status: eventType };

    if (eventType === 'signing_complete' || eventType === 'completed') {
      // Determine who signed based on signer_mode
      if (mode === 'investor_only') {
        const r = recipients.find(r => r.recipientId === '1');
        if (r?.status === 'completed' && !agreement.investor_signed_at) {
          updates.investor_signed_at = new Date().toISOString();
          updates.status = 'investor_signed';
          // Clear regenerate flag on room
          if (agreement.room_id) {
            await base44.asServiceRole.entities.Room.update(agreement.room_id, { requires_regenerate: false, agreement_status: 'investor_signed' }).catch(() => {});
          }
        }
      } else if (mode === 'agent_only') {
        const r = recipients.find(r => r.recipientId === '1');
        if (r?.status === 'completed' && !agreement.agent_signed_at) {
          updates.agent_signed_at = new Date().toISOString();
          updates.status = 'fully_signed';
          // Download signed PDF + lock deal
          try { updates.signed_pdf_url = await downloadAndUploadSignedPdf(base44, envelopeId, agreement.id); } catch (e) { console.error('[webhook] PDF download failed:', e.message); }
          if (agreement.room_id) await lockDeal(base44, agreement.deal_id, agreement.room_id);
        }
      } else {
        // both mode
        const inv = recipients.find(r => r.recipientId === '1');
        const ag = recipients.find(r => r.recipientId === '2');
        if (inv?.status === 'completed' && !agreement.investor_signed_at) updates.investor_signed_at = new Date().toISOString();
        if (ag?.status === 'completed' && !agreement.agent_signed_at) updates.agent_signed_at = new Date().toISOString();

        const invSigned = !!(updates.investor_signed_at || agreement.investor_signed_at);
        const agSigned = !!(updates.agent_signed_at || agreement.agent_signed_at);
        if (invSigned && agSigned) {
          updates.status = 'fully_signed';
          try { updates.signed_pdf_url = await downloadAndUploadSignedPdf(base44, envelopeId, agreement.id); } catch (e) { console.error('[webhook] PDF download failed:', e.message); }
          if (agreement.room_id) await lockDeal(base44, agreement.deal_id, agreement.room_id);
        } else if (invSigned) {
          updates.status = 'investor_signed';
        } else if (agSigned) {
          updates.status = 'agent_signed';
        }
      }
    } else if (eventType === 'voided' || eventType === 'declined') {
      updates.status = 'voided';
    } else if (eventType === 'sent' || eventType === 'delivered') {
      updates.status = 'sent';
    }

    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);

    // Sync room agreement_status
    if (agreement.room_id && updates.status) {
      const roomUpdate = { agreement_status: updates.status };
      if (updates.status === 'fully_signed') roomUpdate.request_status = 'signed';
      await base44.asServiceRole.entities.Room.update(agreement.room_id, roomUpdate).catch(() => {});
    }

    // Store signed PDF in Deal.documents
    if (updates.status === 'fully_signed' && (updates.signed_pdf_url || agreement.signed_pdf_url)) {
      const url = updates.signed_pdf_url || agreement.signed_pdf_url;
      const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
      if (dealArr?.[0]) {
        await base44.asServiceRole.entities.Deal.update(agreement.deal_id, {
          is_fully_signed: true,
          documents: { ...(dealArr[0].documents || {}), internal_agreement: { url, name: 'Internal Agreement (Signed).pdf', uploaded_at: new Date().toISOString() } }
        }).catch(() => {});
      }
    }

    console.log(`[webhook ${VERSION}] Done: ${agreement.id} → ${updates.status || 'no change'}`);
    return Response.json({ received: true });
  } catch (error) {
    console.error(`[webhook ${VERSION}] Error:`, error);
    return Response.json({ received: true, error: error.message });
  }
});