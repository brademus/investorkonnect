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

    // Validate envelope exists before any gating
    if (!agreement.docusign_envelope_id) {
      return Response.json({ 
        error: 'No DocuSign envelope found. Please generate the agreement from the Agreement tab first.'
      }, { status: 400 });
    }

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

    // CRITICAL: Fetch recipient statuses from DocuSign (authoritative source)
    console.log('[DocuSign] Fetching recipient statuses from DocuSign...');
    let investorRecipient = null;
    let agentRecipient = null;
    let recipientIdByEmail = {};

    try {
      const recipientsUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`;
      const recipientsResponse = await fetch(recipientsUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!recipientsResponse.ok) {
        const errorText = await recipientsResponse.text();
        console.error('[DocuSign] Failed to fetch recipients:', errorText);
        return Response.json({
          error: 'Failed to verify signing status. Please try again in a moment.'
        }, { status: 500 });
      }

      const recipients = await recipientsResponse.json();
      const signers = recipients.signers || [];

      console.log('[DocuSign] Recipients from envelope:', JSON.stringify(signers.map(s => ({
        recipientId: s.recipientId,
        email: s.email,
        status: s.status,
        routingOrder: s.routingOrder
      })), null, 2));

      // Match by stored recipient ID (primary) or email (fallback)
      investorRecipient = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id));
      if (!investorRecipient) {
        investorRecipient = signers.find(s => s.email?.toLowerCase() === agreement.investor_email?.toLowerCase());
      }

      agentRecipient = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id));
      if (!agentRecipient) {
        agentRecipient = signers.find(s => s.email?.toLowerCase() === agreement.agent_email?.toLowerCase());
      }

      if (!investorRecipient || !agentRecipient) {
        return Response.json({
          error: 'Envelope recipients not found in DocuSign. Please regenerate the agreement.',
          debug: {
            storedInvestorId: agreement.investor_recipient_id,
            storedAgentId: agreement.agent_recipient_id,
            actualSigners: signers.map(s => ({ id: s.recipientId, email: s.email, status: s.status }))
          }
        }, { status: 400 });
      }

      console.log('[DocuSign] ✓ Found recipients:', {
        investor: { id: investorRecipient.recipientId, email: investorRecipient.email },
        agent: { id: agentRecipient.recipientId, email: agentRecipient.email }
      });

      console.log('[DocuSign] Recipients found:', {
        investor: { id: investorRecipient.recipientId, email: investorRecipient.email, status: investorRecipient.status },
        agent: { id: agentRecipient.recipientId, email: agentRecipient.email, status: agentRecipient.status }
      });

      // Treat both "completed" and "signed" as completion
      const investorCompleted = investorRecipient.status === 'completed' || investorRecipient.status === 'signed';

      // AGENT GATING: Gate off DocuSign recipient status (source of truth), not DB
      if (role === 'agent' && !investorCompleted) {
        const debugInfo = {
          envelopeId: envelopeId,
          investorRecipient: {
            recipientId: investorRecipient.recipientId,
            email: investorRecipient.email,
            status: investorRecipient.status
          },
          agentTrying: role
        };
        console.error('[DocuSign] ❌ Agent cannot sign - investor status is:', investorRecipient.status);
        return Response.json({
          error: `The investor must sign this agreement first. (Investor status in DocuSign: ${investorRecipient.status})`,
          debug: debugInfo
        }, { status: 400 });
      }

      if (role === 'agent' && investorCompleted) {
        console.log('[DocuSign] ✓ DocuSign confirms investor signed - agent can proceed');
      }

      // Reconcile DB: update investor_signed_at if DocuSign shows signed but DB doesn't
      if (investorCompleted && !agreement.investor_signed_at) {
        const syncUpdate = {
          investor_signed_at: investorRecipient.signedDateTime || new Date().toISOString(),
          status: 'investor_signed'
        };
        await base44.asServiceRole.entities.LegalAgreement.update(agreement_id, syncUpdate);
        console.log('[DocuSign] ✓ Synced investor signature from DocuSign to DB');
        agreement.investor_signed_at = syncUpdate.investor_signed_at;
        agreement.status = syncUpdate.status;
      }
    } catch (syncError) {
      console.error('[DocuSign] Critical error fetching recipients:', syncError.message);
      return Response.json({
        error: 'Failed to verify signing status. Please try again in a moment.'
      }, { status: 500 });
    }

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
    
    // Use stored IDs from agreement (these are what the envelope was created with)
    const storedRecipientId = role === 'investor' ? agreement.investor_recipient_id : agreement.agent_recipient_id;
    const clientUserId = role === 'investor' ? agreement.investor_client_user_id : agreement.agent_client_user_id;
    const profileId = role === 'investor' ? agreement.investor_profile_id : agreement.agent_profile_id;
    const docusignRecipient = role === 'investor' ? investorRecipient : agentRecipient;

    console.log('[DocuSign] Signing session for', role, ':', {
      storedRecipientId,
      actualRecipientInEnvelope: docusignRecipient.recipientId,
      clientUserId,
      email: docusignRecipient.email
    });
    
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ 
        error: `Profile not found for ${role}`
      }, { status: 404 });
    }
    
    // Create recipient view using STORED recipient ID (critical for matching)
    const recipientViewRequest = {
      returnUrl: docusignReturnUrl,
      authenticationMethod: 'none',
      email: docusignRecipient.email,
      userName: docusignRecipient.email,
      clientUserId: clientUserId,
      recipientId: storedRecipientId
    };
    
    console.log('[DocuSign] Creating embedded signing session:', {
      role,
      envelopeId,
      storedRecipientId,
      clientUserId,
      email: docusignRecipient.email
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
        storedRecipientId,
        clientUserId,
        role
      });

      let userMsg = errorMsg;
      if (errorMsg.includes('out of sequence') || errorMsg.includes('OUT_OF_SEQUENCE')) {
        userMsg = role === 'agent' 
          ? 'The investor must sign first. If they already signed, try regenerating the agreement.'
          : 'Signing sequence error. Please regenerate the agreement.';
      } else if (errorMsg.includes('RECIPIENT_') || errorMsg.includes('recipient')) {
        userMsg = 'Recipient mismatch detected. Please regenerate the agreement.';
      }

      return Response.json({ 
        error: userMsg,
        details: errorMsg
      }, { status: 400 });
    }

    const viewData = await viewResponse.json();

    if (!viewData.url) {
      console.error('[DocuSign] No URL in recipient view response:', viewData);
      return Response.json({ error: 'Failed to generate signing URL from DocuSign' }, { status: 500 });
    }

    console.log('[DocuSign] ✓ Signing session created - URL:', viewData.url.substring(0, 50) + '...');

    return Response.json({ 
      signing_url: viewData.url
    });
  } catch (error) {
    console.error('[docusignCreateSigningSession] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});