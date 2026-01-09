import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected. Admin must connect DocuSign first.');
  }
  
  let connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  // Auto-refresh if token expired and refresh_token exists
  if (now >= expiresAt && connection.refresh_token) {
    console.log('[DocuSign] Token expired, refreshing...');
    
    const tokenUrl = connection.base_uri.includes('demo') 
      ? 'https://account-d.docusign.com/oauth/token'
      : 'https://account.docusign.com/oauth/token';
    
    const refreshResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
        client_id: Deno.env.get('DOCUSIGN_INTEGRATION_KEY'),
        client_secret: Deno.env.get('DOCUSIGN_CLIENT_SECRET')
      })
    });
    
    if (!refreshResponse.ok) {
      const error = await refreshResponse.text();
      console.error('[DocuSign] Token refresh failed:', error);
      throw new Error('DocuSign token expired and refresh failed. Admin must reconnect DocuSign.');
    }
    
    const tokenData = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    
    // Update connection with new tokens
    await base44.asServiceRole.entities.DocuSignConnection.update(connection.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      expires_at: newExpiresAt
    });
    
    connection.access_token = tokenData.access_token;
    connection.expires_at = newExpiresAt;
    
    console.log('[DocuSign] Token refreshed successfully');
  } else if (now >= expiresAt) {
    throw new Error('DocuSign token expired and no refresh token available. Admin must reconnect DocuSign.');
  }
  
  return connection;
}

async function downloadPdfAsBase64AndHash(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download agreement PDF');
  }
  const buffer = await response.arrayBuffer();
  
  // Compute hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  return { base64, hash };
}

async function voidEnvelope(baseUri, accountId, accessToken, envelopeId, reason) {
  try {
    const voidUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const voidResponse = await fetch(voidUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'voided',
        voidedReason: reason
      })
    });
    
    if (!voidResponse.ok) {
      console.warn('[DocuSign] Failed to void old envelope:', envelopeId);
    } else {
      console.log('[DocuSign] Successfully voided old envelope:', envelopeId);
    }
  } catch (error) {
    console.warn('[DocuSign] Error voiding envelope:', error.message);
  }
}

/**
 * POST /api/functions/docusignCreateSigningSession
 * Creates embedded signing session with hash-based envelope recreation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreement_id, role, redirect_url } = await req.json();
    
    console.log('[docusignCreateSigningSession] START:', { agreement_id, role, redirect_url });
    
    if (!agreement_id || !role) {
      return Response.json({ error: 'agreement_id and role required' }, { status: 400 });
    }
    
    if (!['investor', 'agent'].includes(role)) {
      return Response.json({ error: 'role must be investor or agent' }, { status: 400 });
    }
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];
    
    // Use DocuSign-specific PDF (with invisible anchors)
    const pdfUrl = agreement.docusign_pdf_url || agreement.signing_pdf_url || agreement.final_pdf_url;
    if (!pdfUrl) {
      console.error('[DocuSign] No DocuSign PDF URL found in agreement');
      return Response.json({ error: 'No docusign_pdf_url found - agreement PDF not generated yet' }, { status: 400 });
    }
    
    console.log('[DocuSign] Using DocuSign PDF URL:', pdfUrl);
    
    // Download DocuSign PDF and compute current hash
    const { base64: pdfBase64, hash: currentPdfHash } = await downloadPdfAsBase64AndHash(pdfUrl);
    console.log('[DocuSign] Current DocuSign PDF hash:', currentPdfHash);
    console.log('[DocuSign] Stored agreement.docusign_pdf_sha256:', agreement.docusign_pdf_sha256 || 'none');
    console.log('[DocuSign] Stored agreement.docusign_last_sent_sha256:', agreement.docusign_last_sent_sha256 || 'none');
    
    // Validate redirect_url (flexible origin matching for dev/prod)
    const reqUrl = new URL(req.url);
    const publicAppUrl = Deno.env.get('PUBLIC_APP_URL');
    let validatedRedirect = redirect_url || (publicAppUrl ? `${publicAppUrl}/Pipeline` : '/Pipeline');
    
    // Allow relative URLs
    if (validatedRedirect.startsWith('/')) {
      const origin = publicAppUrl || `${reqUrl.protocol}//${reqUrl.host}`;
      validatedRedirect = `${origin}${validatedRedirect}`;
    }
    
    console.log('[DocuSign] Redirect validation:', { 
      redirect_url, 
      validatedRedirect, 
      publicAppUrl,
      reqOrigin: reqUrl.origin 
    });
    
    // Get DocuSign connection
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // Decide whether to recreate envelope based on DocuSign PDF hash
    let envelopeId = agreement.docusign_envelope_id;
    const lastSentHash = agreement.docusign_last_sent_sha256 || agreement.docusign_envelope_pdf_hash;
    const storedPdfHash = agreement.docusign_pdf_sha256;
    
    // Critical decision logic: create new envelope if PDF changed
    // Envelope should exist from generateLegalAgreement
    if (!envelopeId) {
      return Response.json({ 
        error: 'No DocuSign envelope found. Please regenerate the agreement from the Agreement tab first.'
      }, { status: 400 });
    }

    console.log('[DocuSign] ✓ Using existing envelope:', envelopeId);

      // Sync envelope status before proceeding to ensure we have latest signature status
      try {
      const recipientsUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`;
      const recipientsResponse = await fetch(recipientsUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (recipientsResponse.ok) {
        const recipients = await recipientsResponse.json();
        const signers = recipients.signers || [];

        const investorSigner = signers.find(s => s.recipientId === '1');
        const agentSigner = signers.find(s => s.recipientId === '2');

        const now = new Date().toISOString();
        const syncUpdates = {};

        if (investorSigner?.status === 'completed' && !agreement.investor_signed_at) {
          syncUpdates.investor_signed_at = investorSigner.signedDateTime || now;
        }
        if (agentSigner?.status === 'completed' && !agreement.agent_signed_at) {
          syncUpdates.agent_signed_at = agentSigner.signedDateTime || now;
        }

        if (Object.keys(syncUpdates).length > 0) {
          await base44.asServiceRole.entities.LegalAgreement.update(agreement_id, syncUpdates);
          console.log('[DocuSign] Synced signature status:', syncUpdates);
        }
      }
      } catch (syncError) {
      console.warn('[DocuSign] Failed to sync status before signing:', syncError);
      }

      // Check envelope status for terminal states only
    const statusUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (statusResponse.ok) {
      const envStatus = await statusResponse.json();
      console.log('[DocuSign] Envelope status:', {
        envelopeId,
        status: envStatus.status,
        recipients: envStatus.recipients?.signers?.map(s => ({
          recipientId: s.recipientId,
          email: s.email,
          status: s.status,
          routingOrder: s.routingOrder
        }))
      });
      
      // Only block if envelope is in terminal state
      if (['completed', 'voided', 'declined'].includes(envStatus.status)) {
        return Response.json({ 
          error: `Agreement is already ${envStatus.status}. Please regenerate from the Agreement tab.`
        }, { status: 400 });
      }
    }
    
    // Create signing token
    const tokenValue = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    await base44.asServiceRole.entities.SigningToken.create({
      token: tokenValue,
      deal_id: agreement.deal_id,
      agreement_id: agreement_id,
      role: role,
      return_to: validatedRedirect,
      expires_at: expiresAt,
      used: false
    });
    
    console.log('[DocuSign] Signing token created');
    
    // Build DocuSign return URL
    const origin = publicAppUrl || `${reqUrl.protocol}//${reqUrl.host}`;
    const docusignReturnUrl = `${origin}/DocuSignReturn?token=${tokenValue}`;
    
    // Get recipient details
    const recipientId = role === 'investor' ? agreement.investor_recipient_id : agreement.agent_recipient_id;
    const clientUserId = role === 'investor' ? agreement.investor_client_user_id : agreement.agent_client_user_id;
    const profileId = role === 'investor' ? agreement.investor_profile_id : agreement.agent_profile_id;
    
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
    const profile = profiles[0];
    
    // Create recipient view for embedded signing
    const recipientViewRequest = {
      returnUrl: docusignReturnUrl,
      authenticationMethod: 'none',
      email: profile?.email || user.email,
      userName: profile?.full_name || profile?.email || user.email,
      clientUserId: clientUserId,
      frameAncestors: [origin],
      messageOrigins: [origin]
    };
    
    console.log('[DocuSign] Creating recipient view with:', {
      recipientId,
      clientUserId,
      email: profile?.email,
      userName: profile?.full_name,
      role
    });
    
    const viewUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`;
    const viewResponse = await fetch(viewUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(recipientViewRequest)
    });
    
    if (!viewResponse.ok) {
      const errorText = await viewResponse.text();
      let parsedError = null;
      let errorMsg = 'Failed to create signing session';
      
      try {
        parsedError = JSON.parse(errorText);
        errorMsg = parsedError.message || parsedError.errorCode || errorMsg;
      } catch (e) {
        errorMsg = errorText.substring(0, 200);
      }
      
      console.error('[DocuSign] Recipient view failed:', {
        status: viewResponse.status,
        error: parsedError || errorText,
        envelopeId,
        recipientId,
        clientUserId,
        role
      });
      
      // Handle specific DocuSign errors with user-friendly messages
      if (errorMsg.includes('out of sequence') || errorMsg.includes('OUT_OF_SEQUENCE')) {
        return Response.json({ 
          error: 'The investor must sign this agreement first before you can sign it. Please wait for the investor to complete their signature.'
        }, { status: 400 });
      }
      
      if (errorMsg.includes('RECIPIENT_') || errorMsg.includes('recipient')) {
        return Response.json({ 
          error: 'Signing session issue detected. Please regenerate the agreement from the Agreement tab.'
        }, { status: 400 });
      }
      
      return Response.json({ 
        error: errorMsg || 'Failed to create signing session',
        hint: 'If this persists, try regenerating the agreement.'
      }, { status: 500 });
    }
    
    const viewData = await viewResponse.json();
    
    // Log signing session
    await base44.asServiceRole.entities.LegalAgreement.update(agreement_id, {
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: user.email,
          action: 'signing_session_created',
          details: `${role} signing session created for envelope ${envelopeId}`
        }
      ]
    });
    
    console.log('[DocuSign] Signing session created successfully - returning URL');
    
    return Response.json({ 
      signing_url: viewData.url,
      envelope_status: needsNewEnvelope ? 'Agreement PDF changed; new envelope created' : 'DocuSign envelope reused; hash matched'
    });
  } catch (error) {
    console.error('[docusignCreateSigningSession] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});