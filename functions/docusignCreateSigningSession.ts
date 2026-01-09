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
    const needsNewEnvelope = !envelopeId || 
                             !lastSentHash || 
                             lastSentHash !== currentPdfHash ||
                             (storedPdfHash && storedPdfHash !== currentPdfHash) ||
                             agreement.docusign_status === 'completed' || 
                             agreement.docusign_status === 'voided' ||
                             agreement.docusign_status === 'declined' ||
                             agreement.docusign_status === 'expired';
    
    console.log('[DocuSign] Envelope Decision:', {
      needsNewEnvelope,
      reason: !envelopeId ? 'no_envelope' : 
              !lastSentHash ? 'no_last_sent_hash' :
              lastSentHash !== currentPdfHash ? 'hash_mismatch' :
              (storedPdfHash && storedPdfHash !== currentPdfHash) ? 'stored_hash_mismatch' :
              ['completed', 'voided', 'declined', 'expired'].includes(agreement.docusign_status) ? `status_${agreement.docusign_status}` :
              'reuse_existing',
      currentPdfHash: currentPdfHash.substring(0, 16) + '...',
      lastSentHash: lastSentHash ? lastSentHash.substring(0, 16) + '...' : 'none',
      storedPdfHash: storedPdfHash ? storedPdfHash.substring(0, 16) + '...' : 'none',
      existingEnvelopeId: envelopeId || 'none'
    });
    
    if (needsNewEnvelope) {
      console.log('[DocuSign] ⚠️ Creating NEW envelope because PDF changed or no valid envelope exists');
      
      // Void old envelope if it exists
      if (envelopeId && agreement.docusign_status !== 'completed' && agreement.docusign_status !== 'voided') {
        await voidEnvelope(baseUri, accountId, accessToken, envelopeId, 'Agreement regenerated – replacing document');
      }
      
      // Load profiles
      const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.investor_profile_id });
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.agent_profile_id });
      const investor = investorProfiles[0];
      const agent = agentProfiles[0];
      
      if (!investor || !agent) {
        return Response.json({ error: 'Investor or agent profile not found' }, { status: 404 });
      }
      
      // Generate unique clientUserIds for embedded signing
      const investorClientUserId = `investor_${agreement.id}_${Date.now()}`;
      const agentClientUserId = `agent_${agreement.id}_${Date.now()}`;
      
      // Create envelope with both signers - use descriptive document name
      const docName = `InvestorKonnect Internal Agreement – ${agreement.governing_state} – ${agreement.deal_id} – v${agreement.agreement_version || '2.1'}.pdf`;
      
      const envelopeDefinition = {
        emailSubject: `Sign Agreement - ${agreement.governing_state} Deal`,
        documents: [{
          documentBase64: pdfBase64,
          name: docName,
          fileExtension: 'pdf',
          documentId: '1'
        }],
        recipients: {
          signers: [
            {
              email: investor.email,
              name: investor.full_name || investor.email,
              recipientId: '1',
              routingOrder: '1',
              clientUserId: investorClientUserId,
              tabs: {
                signHereTabs: [{
                  documentId: '1',
                  anchorString: '[[INVESTOR_SIGN]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true
                }],
                dateSignedTabs: [{
                  documentId: '1',
                  anchorString: '[[INVESTOR_DATE]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true
                }],
                fullNameTabs: [{
                  documentId: '1',
                  anchorString: '[[INVESTOR_PRINT]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true,
                  name: 'Investor Full Name',
                  value: investor.full_name || investor.email,
                  locked: true,
                  required: true,
                  tabLabel: 'investorFullName'
                }]
              }
            },
            {
              email: agent.email,
              name: agent.full_name || agent.email,
              recipientId: '2',
              routingOrder: '2',
              clientUserId: agentClientUserId,
              tabs: {
                signHereTabs: [{
                  documentId: '1',
                  anchorString: '[[AGENT_SIGN]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true
                }],
                dateSignedTabs: [{
                  documentId: '1',
                  anchorString: '[[AGENT_DATE]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true
                }],
                fullNameTabs: [{
                  documentId: '1',
                  anchorString: '[[AGENT_PRINT]]',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  anchorIgnoreIfNotPresent: false,
                  anchorCaseSensitive: false,
                  anchorMatchWholeWord: true,
                  name: 'Agent Full Name',
                  value: agent.full_name || agent.email,
                  locked: true,
                  required: true,
                  tabLabel: 'agentFullName'
                }],
                textTabs: [
                  {
                    documentId: '1',
                    anchorString: '[[AGENT_LICENSE]]',
                    anchorUnits: 'pixels',
                    anchorXOffset: '0',
                    anchorYOffset: '0',
                    anchorIgnoreIfNotPresent: false,
                    anchorCaseSensitive: false,
                    anchorMatchWholeWord: true,
                    name: 'License Number',
                    value: agent.agent?.license_number || agent.license_number || '',
                    locked: false,
                    required: true,
                    tabLabel: 'agentLicense'
                  },
                  {
                    documentId: '1',
                    anchorString: '[[AGENT_BROKERAGE]]',
                    anchorUnits: 'pixels',
                    anchorXOffset: '0',
                    anchorYOffset: '0',
                    anchorIgnoreIfNotPresent: false,
                    anchorCaseSensitive: false,
                    anchorMatchWholeWord: true,
                    name: 'Brokerage',
                    value: agent.agent?.brokerage || agent.broker || '',
                    locked: false,
                    required: true,
                    tabLabel: 'agentBrokerage'
                  }
                ]
              }
            }
          ]
        },
        status: 'sent'
      };
      
      const createUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelopeDefinition)
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('[DocuSign] Envelope creation failed:', errorText);
        return Response.json({ error: 'Failed to create envelope', details: errorText }, { status: 500 });
      }
      
      const envelope = await createResponse.json();
      envelopeId = envelope.envelopeId;
      
      console.log('[DocuSign] NEW envelope created:', envelopeId, '- PDF hash:', currentPdfHash.substring(0, 16) + '...');
      console.log('[DocuSign] Tab configuration:', {
        investor: {
          signHere: '[[INVESTOR_SIGN]]',
          fullName: '[[INVESTOR_PRINT]]',
          dateSigned: '[[INVESTOR_DATE]]'
        },
        agent: {
          signHere: '[[AGENT_SIGN]]',
          fullName: '[[AGENT_PRINT]]',
          license: '[[AGENT_LICENSE]]',
          brokerage: '[[AGENT_BROKERAGE]]',
          dateSigned: '[[AGENT_DATE]]'
        },
        offsets: 'anchorXOffset=0, anchorYOffset=0'
      });
      
      // Update agreement with new envelope details and store hash
      await base44.asServiceRole.entities.LegalAgreement.update(agreement_id, {
        docusign_envelope_id: envelopeId,
        docusign_envelope_pdf_hash: currentPdfHash,
        docusign_last_sent_sha256: currentPdfHash,
        docusign_status: 'sent',
        investor_recipient_id: '1',
        agent_recipient_id: '2',
        investor_client_user_id: investorClientUserId,
        agent_client_user_id: agentClientUserId,
        status: agreement.status === 'draft' ? 'sent' : agreement.status,
        audit_log: [
          ...(agreement.audit_log || []),
          {
            timestamp: new Date().toISOString(),
            actor: user.email,
            action: 'envelope_created',
            details: `NEW DocuSign envelope ${envelopeId} created with DocuSign PDF hash ${currentPdfHash.substring(0, 16)}... (DocuSign-specific PDF with invisible anchors)`
          }
        ]
      });
      
      // Reload agreement
      const updated = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
      Object.assign(agreement, updated[0]);
    } else {
      console.log('[DocuSign] ✓ REUSING existing envelope:', envelopeId);
      console.log('[DocuSign] Hash verification passed - PDF unchanged since last sent');
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
    
    console.log('[DocuSign] Requesting recipient view...', { recipientId, clientUserId });
    
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
      console.error('[DocuSign] Recipient view failed:', {
        status: viewResponse.status,
        error: errorText,
        envelopeId,
        recipientId,
        clientUserId,
        role,
        profileEmail: profile?.email
      });
      
      // Try to parse error for better message
      let errorMsg = 'Failed to get signing URL from DocuSign';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (e) {
        // Use raw error text if not JSON
        errorMsg = errorText.substring(0, 200);
      }
      
      return Response.json({ 
        error: errorMsg,
        details: errorText,
        status: viewResponse.status
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