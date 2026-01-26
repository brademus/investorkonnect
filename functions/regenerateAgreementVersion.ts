import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected');
  }
  
  const connection = connections[0];
  const now = new Date();
  const expiresAt = new Date(connection.expires_at);
  
  if (now >= expiresAt && connection.refresh_token) {
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
      throw new Error('DocuSign token refresh failed');
    }
    
    const tokenData = await refreshResponse.json();
    await base44.asServiceRole.entities.DocuSignConnection.update(connection.id, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString()
    });
    
    connection.access_token = tokenData.access_token;
  }
  
  return connection;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deal_id } = await req.json();
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    console.log('[regenerateAgreementVersion] Starting for deal:', deal_id);
    
    // Load deal with accepted terms
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    const acceptedTerms = deal.proposed_terms || {};
    if (!acceptedTerms.buyer_commission_type) {
      return Response.json({ error: 'No accepted terms found in deal' }, { status: 400 });
    }
    
    // Get current active version (if any)
    const activeVersions = await base44.asServiceRole.entities.AgreementVersion.filter({
      deal_id,
      status: { $in: ['draft', 'awaiting_investor_signature', 'awaiting_agent_signature'] }
    }, '-version', 1);
    
    const currentVersion = activeVersions[0];
    const nextVersion = currentVersion ? currentVersion.version + 1 : 1;
    
    // Void current version's envelope if it exists
    if (currentVersion?.docusign_envelope_id) {
      console.log('[regenerateAgreementVersion] Voiding previous envelope:', currentVersion.docusign_envelope_id);
      
      try {
        const connection = await getDocuSignConnection(base44);
        const { access_token, account_id, base_uri } = connection;
        
        const voidUrl = `${base_uri}/restapi/v2.1/accounts/${account_id}/envelopes/${currentVersion.docusign_envelope_id}`;
        const voidResp = await fetch(voidUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'voided',
            voidedReason: `Superseded by version ${nextVersion} due to term changes`
          })
        });
        
        if (voidResp.ok) {
          console.log('[regenerateAgreementVersion] ✓ Voided envelope:', currentVersion.docusign_envelope_id);
        } else {
          console.warn('[regenerateAgreementVersion] Failed to void envelope (non-fatal)');
        }
      } catch (voidError) {
        console.warn('[regenerateAgreementVersion] Void error (non-fatal):', voidError.message);
      }
      
      // Mark version as superseded
      await base44.asServiceRole.entities.AgreementVersion.update(currentVersion.id, {
        status: 'superseded',
        superseded_at: new Date().toISOString(),
        superseded_by_version: nextVersion
      });
    }
    
    // Build exhibit_a from accepted terms
    let compensationModel = 'FLAT_FEE';
    if (acceptedTerms.buyer_commission_type === 'percentage') {
      compensationModel = 'COMMISSION_PCT';
    }
    
    const exhibit_a = {
      compensation_model: compensationModel,
      flat_fee_amount: acceptedTerms.buyer_flat_fee || 0,
      commission_percentage: acceptedTerms.buyer_commission_percentage || 0,
      transaction_type: deal.transaction_type || 'ASSIGNMENT',
      agreement_length_days: acceptedTerms.agreement_length || 180,
      termination_notice_days: 30,
      buyer_commission_type: acceptedTerms.buyer_commission_type,
      buyer_commission_amount: acceptedTerms.buyer_commission_percentage || acceptedTerms.buyer_flat_fee
    };
    
    // Call generateLegalAgreement to create new envelope
    const genResponse = await base44.functions.invoke('generateLegalAgreement', {
      deal_id,
      exhibit_a,
      use_buyer_terms: true
    });
    
    if (genResponse.data?.error) {
      throw new Error(genResponse.data.error);
    }
    
    const newAgreement = genResponse.data?.agreement;
    if (!newAgreement) {
      throw new Error('Agreement generation failed');
    }
    
    // Create AgreementVersion record
    const newVersion = await base44.asServiceRole.entities.AgreementVersion.create({
      deal_id,
      version: nextVersion,
      status: 'awaiting_investor_signature',
      terms_snapshot: acceptedTerms,
      docusign_envelope_id: newAgreement.docusign_envelope_id,
      docusign_status: 'sent',
      pdf_url: newAgreement.final_pdf_url,
      docusign_pdf_url: newAgreement.docusign_pdf_url,
      pdf_sha256: newAgreement.docusign_pdf_sha256,
      created_by_role: 'system'
    });
    
    console.log('[regenerateAgreementVersion] ✓ Created version:', nextVersion);
    
    return Response.json({
      success: true,
      version: newVersion,
      agreement: newAgreement
    });
    
  } catch (error) {
    console.error('[regenerateAgreementVersion] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});