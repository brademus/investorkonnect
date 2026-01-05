import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getAccessToken(env) {
  const accessToken = Deno.env.get(`DOCUSIGN_ACCESS_TOKEN_${env.toUpperCase()}`);
  if (!accessToken) {
    throw new Error('DocuSign not connected. Admin must connect DocuSign first.');
  }
  return accessToken;
}

/**
 * POST /api/legalAgreement/:id/docusign/recipientView
 * Get embedded signing URL for investor or agent
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreementId, role } = await req.json();
    
    if (!agreementId || !role) {
      return Response.json({ error: 'agreementId and role required' }, { status: 400 });
    }
    
    if (role !== 'investor' && role !== 'agent') {
      return Response.json({ error: 'role must be "investor" or "agent"' }, { status: 400 });
    }
    
    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreementId });
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];
    
    // Ensure envelope exists
    if (!agreement.docusign_envelope_id) {
      // Create envelope first
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
    
    // Get DocuSign config
    const env = Deno.env.get('DOCUSIGN_ENV') || 'demo';
    const accessToken = await getAccessToken(env);
    const accountId = Deno.env.get(`DOCUSIGN_ACCOUNT_ID_${env.toUpperCase()}`);
    const baseUri = Deno.env.get(`DOCUSIGN_BASE_URI_${env.toUpperCase()}`);
    const returnUrlBase = Deno.env.get('DOCUSIGN_RETURN_URL_BASE') || Deno.env.get('PUBLIC_APP_URL');
    
    if (!accountId || !baseUri) {
      return Response.json({ error: 'DocuSign account not configured' }, { status: 500 });
    }
    
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
    
    // Get deal ID for return URL
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
    const deal = deals[0];
    
    // Create recipient view request
    const recipientViewRequest = {
      returnUrl: `${returnUrlBase}/room?roomId=${deal?.id || agreement.deal_id}&signing=return`,
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
    console.log('[DocuSign] Recipient view created for:', role);
    
    // Audit log
    await base44.asServiceRole.entities.LegalAgreement.update(agreementId, {
      audit_log: [
        ...(agreement.audit_log || []),
        {
          timestamp: new Date().toISOString(),
          actor: user.email,
          action: `${role}_signing_started`,
          details: `${role} opened DocuSign signing UI`
        }
      ]
    });
    
    return Response.json({ 
      success: true,
      url: viewData.url
    });
  } catch (error) {
    console.error('[DocuSign Recipient View] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});