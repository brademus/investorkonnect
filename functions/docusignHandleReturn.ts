import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected');
  }
  
  const connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  if (now >= expiresAt) {
    throw new Error('DocuSign token expired');
  }
  
  return connection;
}

/**
 * POST /api/functions/docusignHandleReturn
 * Handle DocuSign embedded signing completion
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { token, event } = await req.json();
    
    console.log('[docusignHandleReturn] START:', { token, event });
    
    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }
    
    // Validate token
    const tokens = await base44.asServiceRole.entities.SigningToken.filter({ token });
    
    if (tokens.length === 0) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
    }
    
    const signingToken = tokens[0];
    
    // Check expiration
    if (new Date(signingToken.expires_at) < new Date()) {
      return Response.json({ error: 'Token expired' }, { status: 400 });
    }
    
    // Check if already used
    if (signingToken.used) {
      console.log('[docusignHandleReturn] Token already used - returning cached state');
      return Response.json({ 
        success: true,
        returnTo: signingToken.return_to
      });
    }
    
    // Mark token as used
    await base44.asServiceRole.entities.SigningToken.update(signingToken.id, { used: true });
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: signingToken.agreement_id });
    
    if (agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    
    const agreement = agreements[0];
    
    console.log('[docusignHandleReturn] Agreement loaded:', {
      agreement_id: agreement.id,
      envelope_id: agreement.docusign_envelope_id,
      current_status: agreement.status,
      role: signingToken.role
    });
    
    // Fetch envelope status from DocuSign (source of truth)
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    const envelopeId = agreement.docusign_envelope_id;
    if (!envelopeId) {
      console.error('[docusignHandleReturn] No envelope ID found');
      return Response.json({ error: 'No DocuSign envelope ID' }, { status: 400 });
    }
    
    // Get envelope + recipients status
    const envelopeUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const envelopeResponse = await fetch(envelopeUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!envelopeResponse.ok) {
      throw new Error('Failed to fetch envelope status from DocuSign');
    }
    
    const envelope = await envelopeResponse.json();
    console.log('[docusignHandleReturn] Envelope status:', envelope.status);
    
    // Get recipients
    const recipientsUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`;
    const recipientsResponse = await fetch(recipientsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const recipients = await recipientsResponse.json();
    const signers = recipients.signers || [];
    
    console.log('[docusignHandleReturn] Recipients:', signers.map(s => ({
      recipientId: s.recipientId,
      status: s.status,
      signedDateTime: s.signedDateTime
    })));
    
    // Update agreement based on completion
    const updates = {
      docusign_status: envelope.status,
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: 'DocuSign',
          action: 'signer_completed',
          details: `${signingToken.role} completed signing - envelope status: ${envelope.status}`
        }
      ]
    };
    
    const now = new Date().toISOString();
    
    // Check which recipients have completed
    const investorSigner = signers.find(s => s.recipientId === agreement.investor_recipient_id);
    const agentSigner = signers.find(s => s.recipientId === agreement.agent_recipient_id);
    
    const investorCompleted = investorSigner?.status === 'completed';
    const agentCompleted = agentSigner?.status === 'completed';
    
    console.log('[docusignHandleReturn] Completion status:', { investorCompleted, agentCompleted });
    
    // Update signed timestamps
    if (investorCompleted && !agreement.investor_signed_at) {
      updates.investor_signed_at = investorSigner.signedDateTime || now;
      console.log('[docusignHandleReturn] ✓ Investor signed at:', updates.investor_signed_at);
    }
    
    if (agentCompleted && !agreement.agent_signed_at) {
      updates.agent_signed_at = agentSigner.signedDateTime || now;
      console.log('[docusignHandleReturn] ✓ Agent signed at:', updates.agent_signed_at);
    }
    
    // Determine new status
    if (investorCompleted && agentCompleted) {
      // Both signed
      if (agreement.governing_state === 'NJ') {
        updates.status = 'attorney_review_pending';
        const reviewEnd = new Date();
        reviewEnd.setDate(reviewEnd.getDate() + 3);
        updates.nj_review_end_at = reviewEnd.toISOString();
        updates.audit_log.push({
          timestamp: now,
          actor: 'system',
          action: 'nj_review_started',
          details: 'NJ attorney review period started (3 business days)'
        });
      } else {
        updates.status = 'fully_signed';
        updates.audit_log.push({
          timestamp: now,
          actor: 'system',
          action: 'unlock_event',
          details: 'Agreement fully signed - deal unlocked'
        });
      }
    } else if (investorCompleted && !agentCompleted) {
      updates.status = 'investor_signed';
    } else if (agentCompleted && !investorCompleted) {
      updates.status = 'agent_signed';
    }
    
    console.log('[docusignHandleReturn] New status:', updates.status);
    
    // Fetch signed PDF if envelope is completed
    if (envelope.status === 'completed' && !agreement.signed_pdf_url) {
      console.log('[docusignHandleReturn] Fetching signed PDF from DocuSign...');
      
      const pdfUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;
      const pdfResponse = await fetch(pdfUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (pdfResponse.ok) {
        const pdfBytes = await pdfResponse.arrayBuffer();
        
        // Upload to storage
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfFile = new File([pdfBlob], `agreement_${agreement.deal_id}_signed.pdf`);
        const upload = await base44.integrations.Core.UploadFile({ file: pdfFile });
        
        updates.signed_pdf_url = upload.file_url;
        console.log('[docusignHandleReturn] ✓ Signed PDF uploaded:', upload.file_url);
      }
    }
    
    // Update LegalAgreement
    await base44.asServiceRole.entities.LegalAgreement.update(signingToken.agreement_id, updates);
    console.log('[docusignHandleReturn] ✓ Agreement updated');
    
    // CRITICAL: Sync status to Room for UI consistency
    if (signingToken.deal_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: signingToken.deal_id });
      
      if (rooms.length > 0) {
        const room = rooms[0];
        const roomUpdates = {
          agreement_status: updates.status || agreement.status
        };
        
        // Unlock room if fully signed
        if (updates.status === 'fully_signed') {
          roomUpdates.request_status = 'signed';
          roomUpdates.signed_at = now;
          roomUpdates.audit_log = [
            ...(room.audit_log || []),
            {
              timestamp: now,
              actor: 'system',
              action: 'deal_unlocked',
              details: 'Agreement fully signed - room unlocked'
            }
          ];
        }
        
        await base44.asServiceRole.entities.Room.update(room.id, roomUpdates);
        console.log('[docusignHandleReturn] ✓ Room synced:', roomUpdates);
      }
    }
    
    return Response.json({ 
      success: true,
      returnTo: signingToken.return_to,
      status: updates.status || agreement.status
    });
  } catch (error) {
    console.error('[docusignHandleReturn] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});