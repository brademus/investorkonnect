import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getAccessToken(env) {
  const accessToken = Deno.env.get(`DOCUSIGN_ACCESS_TOKEN_${env.toUpperCase()}`);
  if (!accessToken) {
    throw new Error('DocuSign not connected');
  }
  return accessToken;
}

/**
 * POST /api/docusign/handleReturn
 * Process return from DocuSign embedded signing
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { token } = await req.json();
    
    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }
    
    // Look up token
    const tokens = await base44.asServiceRole.entities.SigningToken.filter({ token });
    if (!tokens || tokens.length === 0) {
      return Response.json({ error: 'Invalid token' }, { status: 404 });
    }
    
    const signingToken = tokens[0];
    
    // Check if token is expired
    if (new Date(signingToken.expires_at) < new Date()) {
      return Response.json({ error: 'Token expired' }, { status: 400 });
    }
    
    // Check if token already used
    if (signingToken.used) {
      return Response.json({ error: 'Token already used' }, { status: 400 });
    }
    
    // Mark token as used
    await base44.asServiceRole.entities.SigningToken.update(signingToken.id, { used: true });
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: signingToken.agreement_id });
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];
    
    // Fetch envelope status from DocuSign
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const accessToken = await getAccessToken(env);
    const accountId = Deno.env.get(`DOCUSIGN_ACCOUNT_ID_${env.toUpperCase()}`);
    const baseUri = Deno.env.get(`DOCUSIGN_BASE_URI_${env.toUpperCase()}`);
    
    if (!accountId || !baseUri) {
      return Response.json({ error: 'DocuSign not configured' }, { status: 500 });
    }
    
    const envelopeUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${agreement.docusign_envelope_id}`;
    const envelopeResponse = await fetch(envelopeUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!envelopeResponse.ok) {
      console.error('[DocuSign] Failed to fetch envelope status');
      return Response.json({ error: 'Failed to check signature status' }, { status: 500 });
    }
    
    const envelope = await envelopeResponse.json();
    console.log('[DocuSign] Envelope status:', envelope.status);
    
    // Update agreement based on envelope status
    const updateData = {
      docusign_status: envelope.status,
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: user.email,
          action: 'DOCUSIGN_RETURN',
          details: `Returned from DocuSign signing (status: ${envelope.status})`
        }
      ]
    };
    
    // Check recipient statuses
    const recipients = envelope.recipients?.signers || [];
    const investorRecipient = recipients.find(r => r.recipientId === agreement.investor_recipient_id);
    const agentRecipient = recipients.find(r => r.recipientId === agreement.agent_recipient_id);
    
    // Update signing timestamps
    if (investorRecipient?.status === 'completed' && !agreement.investor_signed_at) {
      updateData.investor_signed_at = new Date().toISOString();
      updateData.investor_ip = investorRecipient.deliveryMethod === 'email' ? null : 'embedded';
    }
    
    if (agentRecipient?.status === 'completed' && !agreement.agent_signed_at) {
      updateData.agent_signed_at = new Date().toISOString();
      updateData.agent_ip = agentRecipient.deliveryMethod === 'email' ? null : 'embedded';
    }
    
    // Determine agreement status
    const investorSigned = investorRecipient?.status === 'completed';
    const agentSigned = agentRecipient?.status === 'completed';
    
    if (investorSigned && agentSigned) {
      // Check if NJ attorney review applies
      if (agreement.governing_state === 'NJ') {
        updateData.status = 'attorney_review_pending';
        // Set 3-day review period ending at 11:59 PM
        const reviewEnd = new Date();
        reviewEnd.setDate(reviewEnd.getDate() + 3);
        reviewEnd.setHours(23, 59, 59, 999);
        updateData.nj_review_end_at = reviewEnd.toISOString();
        
        updateData.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM',
          action: 'NJ_REVIEW_STARTED',
          details: `3-day attorney review period started (ends ${reviewEnd.toISOString()})`
        });
      } else {
        updateData.status = 'fully_signed';
        
        // UNLOCK DEAL: Mark sensitive fields as accessible
        updateData.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM',
          action: 'UNLOCK_EVENT',
          details: 'Agreement fully signed - sensitive deal data unlocked'
        });
      }
    } else if (investorSigned && !agentSigned) {
      updateData.status = 'investor_signed';
    } else if (agentSigned && !investorSigned) {
      updateData.status = 'agent_signed';
    }
    
    // Update agreement
    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updateData);
    
    console.log('[DocuSign] Agreement updated:', updateData.status);
    
    // Return redirect URL
    return Response.json({
      success: true,
      redirectTo: signingToken.return_to,
      status: updateData.status,
      investorSigned,
      agentSigned
    });
  } catch (error) {
    console.error('[DocuSign Handle Return] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});