import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected. Admin must connect DocuSign first.');
  }
  
  const connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  if (now >= expiresAt) {
    throw new Error('DocuSign token expired. Admin must reconnect DocuSign.');
  }
  
  return connection;
}

async function downloadPdfAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download agreement PDF');
  }
  const buffer = await response.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * POST /api/functions/docusignCreateSigningSession
 * Creates embedded signing session with token-based return flow
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreement_id, role, redirect_url } = await req.json();
    
    console.log('[docusignCreateSigningSession]', { agreement_id, role, redirect_url });
    
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
    
    // Validate redirect_url (allow localhost for dev)
    const reqUrl = new URL(req.url);
    const origin = Deno.env.get('PUBLIC_APP_URL') || `${reqUrl.protocol}//${reqUrl.host}`;
    let validatedRedirect = redirect_url || `${origin}/Pipeline`;
    
    // For development, allow localhost:3000 redirects
    const allowedOrigins = [origin];
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
    }
    
    try {
      const redirectUrl = new URL(validatedRedirect);
      const isAllowed = allowedOrigins.some(allowed => {
        const allowedUrl = new URL(allowed);
        return redirectUrl.origin === allowedUrl.origin;
      });
      
      if (!isAllowed) {
        return Response.json({ error: 'Invalid redirect URL - must be same origin' }, { status: 400 });
      }
      validatedRedirect = redirectUrl.toString();
    } catch (e) {
      return Response.json({ error: 'Invalid redirect URL format' }, { status: 400 });
    }
    
    // Get DocuSign connection
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // Create or reuse envelope
    let envelopeId = agreement.docusign_envelope_id;
    
    if (!envelopeId || agreement.docusign_status === 'completed' || agreement.docusign_status === 'voided') {
      console.log('[DocuSign] Creating new envelope...');
      
      // Load profiles
      const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.investor_profile_id });
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agreement.agent_profile_id });
      const investor = investorProfiles[0];
      const agent = agentProfiles[0];
      
      if (!investor || !agent) {
        return Response.json({ error: 'Investor or agent profile not found' }, { status: 404 });
      }
      
      // Download PDF
      const pdfUrl = agreement.final_pdf_url || agreement.pdf_file_url;
      if (!pdfUrl) {
        return Response.json({ error: 'Agreement PDF not generated yet' }, { status: 400 });
      }
      
      const pdfBase64 = await downloadPdfAsBase64(pdfUrl);
      
      // Generate unique clientUserIds for embedded signing
      const investorClientUserId = `investor_${agreement.id}_${Date.now()}`;
      const agentClientUserId = `agent_${agreement.id}_${Date.now()}`;
      
      // Create envelope with both signers
      const envelopeDefinition = {
        emailSubject: `Sign Agreement - ${agreement.governing_state} Deal`,
        documents: [{
          documentBase64: pdfBase64,
          name: 'Investor-Agent Operating Agreement',
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
                  anchorString: '/INVESTOR_SIGNATURE/',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0'
                }],
                dateSignedTabs: [{
                  anchorString: '/INVESTOR_DATE/',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0'
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
                  anchorString: '/AGENT_SIGNATURE/',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0'
                }],
                dateSignedTabs: [{
                  anchorString: '/AGENT_DATE/',
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0'
                }]
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
      
      console.log('[DocuSign] Envelope created:', envelopeId);
      
      // Update agreement with envelope details
      await base44.asServiceRole.entities.LegalAgreement.update(agreement_id, {
        docusign_envelope_id: envelopeId,
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
            details: `DocuSign envelope ${envelopeId} created`
          }
        ]
      });
      
      // Reload agreement
      const updated = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
      Object.assign(agreement, updated[0]);
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
      console.error('[DocuSign] Recipient view failed:', viewResponse.status, errorText);
      return Response.json({ 
        error: 'Failed to get signing URL from DocuSign',
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
          details: `${role} signing session created`
        }
      ]
    });
    
    console.log('[DocuSign] Signing session created successfully');
    
    return Response.json({ 
      signing_url: viewData.url
    });
  } catch (error) {
    console.error('[docusignCreateSigningSession] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});