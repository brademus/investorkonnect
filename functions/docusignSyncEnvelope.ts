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
 * POST /api/functions/docusignSyncEnvelope
 * Syncs envelope status from DocuSign to LegalAgreement
 * Input: { agreement_id } or { deal_id }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreement_id, deal_id } = await req.json();
    
    console.log('[docusignSyncEnvelope] START:', { agreement_id, deal_id });
    
    // Load agreement
    let agreements;
    if (agreement_id) {
      agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    } else if (deal_id) {
      agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    } else {
      return Response.json({ error: 'agreement_id or deal_id required' }, { status: 400 });
    }
    
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    
    const agreement = agreements[0];
    
    // Verify access
    if (agreement.investor_user_id !== user.id && agreement.agent_user_id !== user.id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    const envelopeId = agreement.docusign_envelope_id;
    if (!envelopeId) {
      return Response.json({ error: 'No DocuSign envelope exists yet' }, { status: 400 });
    }
    
    // Get DocuSign connection
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // Fetch envelope status
    const envelopeUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const envelopeResponse = await fetch(envelopeUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!envelopeResponse.ok) {
      throw new Error('Failed to fetch envelope from DocuSign');
    }
    
    const envelope = await envelopeResponse.json();
    
    // Get recipients
    const recipientsUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`;
    const recipientsResponse = await fetch(recipientsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const recipients = await recipientsResponse.json();
    const signers = recipients.signers || [];
    
    console.log('[docusignSyncEnvelope] Envelope status:', envelope.status);
    console.log('[docusignSyncEnvelope] Signers:', signers.map(s => ({
      recipientId: s.recipientId,
      status: s.status
    })));
    
    // Determine new status
    console.log('[docusignSyncEnvelope] Looking for:', {
      investor_id: agreement.investor_recipient_id,
      agent_id: agreement.agent_recipient_id
    });

    const investorSigner = signers.find(s => s.recipientId === agreement.investor_recipient_id);
    const agentSigner = signers.find(s => s.recipientId === agreement.agent_recipient_id);

    console.log('[docusignSyncEnvelope] Found signers:', {
      investor: { found: !!investorSigner, status: investorSigner?.status, email: investorSigner?.email },
      agent: { found: !!agentSigner, status: agentSigner?.status, email: agentSigner?.email }
    });

    const investorCompleted = investorSigner?.status === 'completed';
    const agentCompleted = agentSigner?.status === 'completed';

    console.log('[docusignSyncEnvelope] Completion status:', { investorCompleted, agentCompleted });
    
    const updates = {
      docusign_status: envelope.status
    };
    
    const now = new Date().toISOString();
    
    if (investorCompleted && !agreement.investor_signed_at) {
      updates.investor_signed_at = investorSigner.signedDateTime || now;
    }
    
    if (agentCompleted && !agreement.agent_signed_at) {
      updates.agent_signed_at = agentSigner.signedDateTime || now;
    }
    
    // Update status
    if (investorCompleted && agentCompleted) {
      if (agreement.governing_state === 'NJ') {
        updates.status = 'attorney_review_pending';
        if (!agreement.nj_review_end_at) {
          const reviewEnd = new Date();
          reviewEnd.setDate(reviewEnd.getDate() + 3);
          updates.nj_review_end_at = reviewEnd.toISOString();
        }
      } else {
        updates.status = 'fully_signed';
      }
    } else if (investorCompleted && !agentCompleted) {
      updates.status = 'investor_signed';
    } else if (agentCompleted && !investorCompleted) {
      updates.status = 'agent_signed';
    }
    
    console.log('[docusignSyncEnvelope] New status:', updates.status);
    
    // Update agreement
    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
    
    // Sync to Room and Deal
    if (agreement.deal_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: agreement.deal_id });
      if (rooms.length > 0) {
        const room = rooms[0];
        const roomUpdates = {
          agreement_status: updates.status || agreement.status
        };
        
        if (updates.status === 'fully_signed' || updates.status === 'attorney_review_pending') {
          roomUpdates.is_fully_signed = true;
          roomUpdates.request_status = 'signed';
          roomUpdates.signed_at = now;
        } else {
          roomUpdates.is_fully_signed = false;
        }
        
        await base44.asServiceRole.entities.Room.update(room.id, roomUpdates);
        console.log('[docusignSyncEnvelope] ✓ Room synced');
      }
      
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
      if (deals.length > 0) {
        await base44.asServiceRole.entities.Deal.update(agreement.deal_id, {
          is_fully_signed: updates.status === 'fully_signed' || updates.status === 'attorney_review_pending'
        });
        console.log('[docusignSyncEnvelope] ✓ Deal synced');
      }
    }
    
    // Return updated agreement
    const updatedAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement.id });
    
    return Response.json({ 
      success: true,
      agreement: updatedAgreements[0]
    });
    
  } catch (error) {
    console.error('[docusignSyncEnvelope] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});