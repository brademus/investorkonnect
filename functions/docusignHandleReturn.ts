import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getAccessToken(env) {
  const accessToken = Deno.env.get(`DOCUSIGN_ACCESS_TOKEN_${env.toUpperCase()}`);
  if (!accessToken) {
    throw new Error('DocuSign not connected');
  }
  return accessToken;
}

function calculateNJReviewEndDate() {
  // NJ: 3 BUSINESS DAYS from now, excluding weekends and US federal holidays
  let date = new Date();
  let businessDays = 0;
  
  // Simple weekend exclusion (production should also check federal holidays)
  while (businessDays < 3) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Not weekend
      businessDays++;
    }
  }
  
  // Set to end of day (11:59 PM)
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
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
    
    // Check if token already used (single-use)
    if (signingToken.used) {
      return Response.json({ error: 'Token already used' }, { status: 400 });
    }
    
    // Mark token as used immediately (single-use security)
    await base44.asServiceRole.entities.SigningToken.update(signingToken.id, { used: true });
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: signingToken.agreement_id });
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];
    
    // Fetch envelope status from DocuSign to verify signature
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
      return Response.json({ error: 'Failed to verify signature status' }, { status: 500 });
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
          details: `Returned from DocuSign signing (status: ${envelope.status}, role: ${signingToken.role})`
        }
      ]
    };
    
    // Check recipient statuses
    const recipients = envelope.recipients?.signers || [];
    const investorRecipient = recipients.find(r => r.recipientId === agreement.investor_recipient_id);
    const agentRecipient = recipients.find(r => r.recipientId === agreement.agent_recipient_id);
    
    // Update signing timestamps based on who just signed
    if (investorRecipient?.status === 'completed' && !agreement.investor_signed_at) {
      updateData.investor_signed_at = new Date().toISOString();
      updateData.investor_ip = 'embedded';
    }
    
    if (agentRecipient?.status === 'completed' && !agreement.agent_signed_at) {
      updateData.agent_signed_at = new Date().toISOString();
      updateData.agent_ip = 'embedded';
    }
    
    // Determine agreement status (STRICT STATE MACHINE)
    const investorSigned = investorRecipient?.status === 'completed';
    const agentSigned = agentRecipient?.status === 'completed';
    
    if (investorSigned && agentSigned) {
      // Both signed - check if NJ attorney review applies
      if (agreement.governing_state === 'NJ') {
        updateData.status = 'attorney_review_pending';
        updateData.nj_review_end_at = calculateNJReviewEndDate();
        
        updateData.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM',
          action: 'NJ_ATTORNEY_REVIEW_STARTED',
          details: `3 business day attorney review period started (ends ${updateData.nj_review_end_at})`
        });
        
        console.log('[DocuSign] NJ deal - entering attorney review until', updateData.nj_review_end_at);
      } else {
        // Non-NJ: immediate fully_signed
        updateData.status = 'fully_signed';
        
        // UNLOCK EVENT: This is the key audit event for unlocking sensitive data
        updateData.audit_log.push({
          timestamp: new Date().toISOString(),
          actor: 'SYSTEM',
          action: 'LEGAL_AGREEMENT_UNLOCK',
          details: 'Agreement fully signed - sensitive deal data (address, seller, contract) now unlocked'
        });
        
        console.log('[DocuSign] Agreement fully signed - sensitive data unlocked');
      }
    } else if (investorSigned && !agentSigned) {
      // Only investor signed
      updateData.status = 'investor_signed';
    } else if (agentSigned && !investorSigned) {
      // Only agent signed (shouldn't happen with routing order, but handle it)
      updateData.status = 'agent_signed';
    } else {
      // Neither signed yet - shouldn't happen but keep as 'sent'
      if (agreement.status === 'draft') {
        updateData.status = 'sent';
      }
    }
    
    // Update agreement
    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updateData);
    
    console.log('[DocuSign] Agreement updated:', {
      id: agreement.id,
      status: updateData.status,
      investorSigned,
      agentSigned
    });
    
    // Return redirect URL and status
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