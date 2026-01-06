import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  // Get the most recent DocuSign connection from any admin user
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected. Admin must connect DocuSign first.');
  }
  
  const connection = connections[0];
  
  // Check if token is expired
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  if (now >= expiresAt) {
    throw new Error('DocuSign token expired. Admin must reconnect DocuSign.');
  }
  
  return connection;
}

/**
 * POST /api/docusign/createSigningSession
 * Create embedded signing session with token-based return URL
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreementId, role, returnTo } = await req.json();
    
    if (!agreementId || !role || !returnTo) {
      return Response.json({ error: 'agreementId, role, and returnTo required' }, { status: 400 });
    }
    
    if (role !== 'investor' && role !== 'agent') {
      return Response.json({ error: 'role must be "investor" or "agent"' }, { status: 400 });
    }
    
    // Validate returnTo is within our app domain (prevent open redirects)
    const appBaseUrl = Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL');
    if (!returnTo.startsWith(appBaseUrl)) {
      return Response.json({ error: 'Invalid return URL' }, { status: 400 });
    }
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreementId });
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];
    
    // Ensure envelope exists
    if (!agreement.docusign_envelope_id) {
      const createResponse = await base44.functions.invoke('docusignCreateEnvelope', {
        agreementId
      });
      
      if (createResponse.data?.error) {
        return Response.json({ error: createResponse.data.error }, { status: 500 });
      }
      
      // Reload agreement
      const updatedAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreementId });
      Object.assign(agreement, updatedAgreements[0]);
    }
    
    // Generate secure token (random 32-char string)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Token expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    // Store token
    await base44.asServiceRole.entities.SigningToken.create({
      token,
      deal_id: agreement.deal_id,
      agreement_id: agreementId,
      role,
      return_to: returnTo,
      expires_at: expiresAt,
      used: false
    });
    
    // Get DocuSign connection from database
    const connection = await getDocuSignConnection(base44);
    const { access_token: accessToken, account_id: accountId, base_uri: baseUri } = connection;
    
    // Load profile for this role
    const profileId = role === 'investor' ? agreement.investor_profile_id : agreement.agent_profile_id;
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get recipient info
    const recipientId = role === 'investor' ? agreement.investor_recipient_id : agreement.agent_recipient_id;
    const clientUserId = role === 'investor' ? agreement.investor_client_user_id : agreement.agent_client_user_id;
    
    // Construct return URL with token (Base44 uses page name as path)
    const returnUrl = `${appBaseUrl}/DocuSignReturn?token=${token}`;
    
    // Create recipient view request
    const recipientViewRequest = {
      returnUrl,
      authenticationMethod: 'none',
      email: profile.email,
      userName: profile.full_name || profile.email,
      clientUserId: clientUserId,
      recipientId: recipientId
    };
    
    // Get recipient view URL
    const viewUrl = `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes/${agreement.docusign_envelope_id}/views/recipient`;
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
      console.error('[DocuSign] Recipient view failed:', errorText);
      return Response.json({ 
        error: 'Failed to get signing URL',
        details: errorText
      }, { status: 500 });
    }
    
    const viewData = await viewResponse.json();
    console.log('[DocuSign] Embedded signing session created for:', role);
    console.log('[DocuSign] Return URL:', returnUrl);
    
    // Audit log
    await base44.asServiceRole.entities.LegalAgreement.update(agreementId, {
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: user.email,
          action: `${role}_signing_started`,
          details: `${role} opened DocuSign embedded signing`
        }
      ]
    });
    
    return Response.json({ 
      success: true,
      signingUrl: viewData.url,
      returnUrl
    });
  } catch (error) {
    console.error('[DocuSign Create Signing Session] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});