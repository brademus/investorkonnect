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
    // Validate envelope exists
    if (!envelopeId) {
      return Response.json({ 
        error: 'No DocuSign envelope found. Please regenerate the agreement from the Agreement tab first.'
      }, { status: 400 });
    }

    // Validate recipient IDs exist
    if (!agreement.investor_recipient_id || !agreement.agent_recipient_id) {
      return Response.json({ 
        error: 'Missing recipient IDs. Please regenerate the agreement.'
      }, { status: 400 });
    }

    // Validate client user IDs exist
    if (!agreement.investor_client_user_id || !agreement.agent_client_user_id) {
      return Response.json({ 
        error: 'Missing client user IDs. Please regenerate the agreement.'
      }, { status: 400 });
    }

    console.log('[DocuSign] Using existing envelope:', envelopeId);
    console.log('[DocuSign] Investor recipientId:', agreement.investor_recipient_id);
    console.log('[DocuSign] Agent recipientId:', agreement.agent_recipient_id);

    // CRITICAL: Query DocuSign for current recipient status (source of truth)
    console.log('[DocuSign] Querying DocuSign for current recipient statuses...');
    const recipientsUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`;
    const recipientsResponse = await fetch(recipientsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!recipientsResponse.ok) {
      const errorText = await recipientsResponse.text();
      console.error('[DocuSign] Failed to fetch recipients:', errorText);
      return Response.json({ 
        error: 'Failed to verify signing status from DocuSign'
      }, { status: 500 });
    }

    const recipients = await recipientsResponse.json();
    const signers = recipients.signers || [];

    console.log('[DocuSign] DocuSign recipients:', signers.map(s => ({
      recipientId: s.recipientId,
      email: s.email,
      status: s.status,
      routingOrder: s.routingOrder,
      signedDateTime: s.signedDateTime
    })));

    // Find investor and agent signers
    let investorSigner = signers.find(s => s.recipientId === agreement.investor_recipient_id);
    let agentSigner = signers.find(s => s.recipientId === agreement.agent_recipient_id);

    // Fallback to email match if recipientId not found
    if (!investorSigner) {
      const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.investor_profile_id });
      if (investorProfiles.length > 0) {
        investorSigner = signers.find(s => s.email.toLowerCase() === investorProfiles[0].email.toLowerCase());
      }
    }

    if (!agentSigner) {
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.agent_profile_id });
      if (agentProfiles.length > 0) {
        agentSigner = signers.find(s => s.email.toLowerCase() === agentProfiles[0].email.toLowerCase());
      }
    }

    if (!investorSigner || !agentSigner) {
      console.error('[DocuSign] Could not find both recipients in envelope');
      return Response.json({ 
        error: 'Envelope recipients not found. Please regenerate the agreement.'
      }, { status: 400 });
    }

    // DocuSign uses both "completed" and "signed" as completion statuses
    const investorCompleted = investorSigner.status === 'completed' || investorSigner.status === 'signed';
    const agentCompleted = agentSigner.status === 'completed' || agentSigner.status === 'signed';

    console.log('[DocuSign] Current DocuSign status:', {
      investor: {
        recipientId: investorSigner.recipientId,
        email: investorSigner.email,
        status: investorSigner.status,
        completed: investorCompleted,
        signedDateTime: investorSigner.signedDateTime,
        routingOrder: investorSigner.routingOrder
      },
      agent: {
        recipientId: agentSigner.recipientId,
        email: agentSigner.email,
        status: agentSigner.status,
        completed: agentCompleted,
        signedDateTime: agentSigner.signedDateTime,
        routingOrder: agentSigner.routingOrder
      },
      envelopeId: envelopeId,
      agreementId: agreement_id
    });

    // RECONCILE: Update DB based on DocuSign truth
    const now = new Date().toISOString();
    const syncUpdates = {
      docusign_status: recipients.envelopeStatus || 'sent'
    };
    let statusChanged = false;

    console.log('[DocuSign] Current DB status:', {
      status: agreement.status,
      investor_signed_at: agreement.investor_signed_at,
      agent_signed_at: agreement.agent_signed_at
    });

    // Update investor signature status
    if (investorCompleted && !agreement.investor_signed_at) {
      syncUpdates.investor_signed_at = investorSigner.signedDateTime || now;
      statusChanged = true;
      console.log('[DocuSign] ✓ Reconciling: Investor signed at', syncUpdates.investor_signed_at);
    }

    // Update agent signature status
    if (agentCompleted && !agreement.agent_signed_at) {
      syncUpdates.agent_signed_at = agentSigner.signedDateTime || now;
      statusChanged = true;
      console.log('[DocuSign] ✓ Reconciling: Agent signed at', syncUpdates.agent_signed_at);
    }

    // Update agreement status based on who completed
    if (investorCompleted && agentCompleted) {
      if (agreement.status !== 'fully_signed' && agreement.status !== 'attorney_review_pending') {
        if (agreement.governing_state === 'NJ') {
          syncUpdates.status = 'attorney_review_pending';
          if (!agreement.nj_review_end_at) {
            const reviewEnd = new Date();
            reviewEnd.setDate(reviewEnd.getDate() + 3);
            syncUpdates.nj_review_end_at = reviewEnd.toISOString();
          }
        } else {
          syncUpdates.status = 'fully_signed';
        }
        statusChanged = true;
        console.log('[DocuSign] ✓ Reconciling: Both signed, status →', syncUpdates.status);
      }
    } else if (investorCompleted && !agentCompleted) {
      if (agreement.status !== 'investor_signed' && agreement.status !== 'fully_signed' && agreement.status !== 'attorney_review_pending') {
        syncUpdates.status = 'investor_signed';
        statusChanged = true;
        console.log('[DocuSign] ✓ Reconciling: Investor signed, status → investor_signed');
      }
    } else if (agentCompleted && !investorCompleted) {
      if (agreement.status !== 'agent_signed' && agreement.status !== 'fully_signed' && agreement.status !== 'attorney_review_pending') {
        syncUpdates.status = 'agent_signed';
        statusChanged = true;
        console.log('[DocuSign] ✓ Reconciling: Agent signed, status → agent_signed');
      }
    }

    // Persist reconciliation
    if (statusChanged || Object.keys(syncUpdates).length > 1) {
      await base44.asServiceRole.entities.LegalAgreement.update(agreement_id, syncUpdates);
      console.log('[DocuSign] ✓ DB reconciled with DocuSign:', syncUpdates);

      // Reload agreement
      const updated = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
      Object.assign(agreement, updated[0]);
    } else {
      console.log('[DocuSign] No reconciliation needed - DB already in sync');
    }

    // GATING: Enforce signing order based on DocuSign truth (with DB fallback)
    if (role === 'agent') {
      console.log('[DocuSign] Checking if agent can sign...');
      console.log('[DocuSign] Investor signer:', {
        recipientId: investorSigner?.recipientId,
        email: investorSigner?.email,
        status: investorSigner?.status,
        signedDateTime: investorSigner?.signedDateTime
      });
      console.log('[DocuSign] investorCompleted:', investorCompleted);
      console.log('[DocuSign] DB investor_signed_at:', agreement.investor_signed_at);

      // Check if investor signed (DocuSign API or DB as fallback)
      const dbSaysInvestorSigned = !!agreement.investor_signed_at;

      if (!investorCompleted && !dbSaysInvestorSigned) {
        console.error('[DocuSign] ❌ Agent cannot sign - investor has not completed signing');
        return Response.json({ 
          error: 'The investor must sign this agreement first before you can sign it. Please wait for the investor to complete their signature.'
        }, { status: 400 });
      }

      if (!investorCompleted && dbSaysInvestorSigned) {
        console.log('[DocuSign] ⚠️ DB shows investor signed but DocuSign status not synced yet - allowing agent to proceed');
      }
    }

    console.log('[DocuSign] ✓ Gating check passed for role:', role);

    // Check for terminal envelope states
    const statusUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (statusResponse.ok) {
      const envStatus = await statusResponse.json();

      if (['completed', 'voided', 'declined'].includes(envStatus.status)) {
        return Response.json({ 
          error: `Agreement is already ${envStatus.status}. Please regenerate from the Agreement tab.`
        }, { status: 400 });
      }
    }

    // Verify PDF hash hasn't changed (prevent signing stale document)
    if (agreement.docusign_last_sent_sha256 && agreement.docusign_last_sent_sha256 !== currentPdfHash) {
      console.error('[DocuSign] ❌ PDF hash mismatch - agreement was regenerated');
      console.error('[DocuSign] Last sent hash:', agreement.docusign_last_sent_sha256.substring(0, 16));
      console.error('[DocuSign] Current hash:', currentPdfHash.substring(0, 16));
      return Response.json({ 
        error: 'Agreement was updated after envelope creation. Please regenerate the agreement to create a new envelope.'
      }, { status: 400 });
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