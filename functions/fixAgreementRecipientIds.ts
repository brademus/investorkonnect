import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections || connections.length === 0) {
    throw new Error('DocuSign not connected');
  }
  const connection = connections[0];
  const now = new Date();
  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  if (expiresAt && now >= expiresAt) {
    throw new Error('DocuSign token expired');
  }
  return connection;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    
    const { deal_id } = await req.json();
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Try AgreementVersion first (get latest non-superseded)
    let agreement = null;
    let isLegacy = false;
    let agreementId = null;
    
    const versions = await base44.asServiceRole.entities.AgreementVersion.filter({ deal_id }, '-version', 100);
    if (versions && versions.length > 0) {
      const current = versions.find(v => v.status !== 'superseded' && v.status !== 'voided');
      if (current) {
        agreement = current;
        agreementId = current.id;
      }
    }
    
    // Fall back to LegalAgreement
    if (!agreement) {
      const legacyAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
      if (legacyAgreements && legacyAgreements.length > 0) {
        agreement = legacyAgreements[0];
        isLegacy = true;
        agreementId = agreement.id;
      }
    }
    
    if (!agreement) {
      return Response.json({ error: 'No agreement found for deal' }, { status: 404 });
    }
    if (!agreement.docusign_envelope_id) {
      return Response.json({ error: 'No DocuSign envelope ID' }, { status: 400 });
    }
    
    console.log('[fixAgreementRecipientIds] Loading envelope:', agreement.docusign_envelope_id);
    
    // Get DocuSign connection
    const connection = await getDocuSignConnection(base44);
    const { access_token, account_id, base_uri } = connection;
    
    // Get envelope details from DocuSign
    const envUrl = `${base_uri}/restapi/v2.1/accounts/${account_id}/envelopes/${agreement.docusign_envelope_id}`;
    const envResp = await fetch(envUrl, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    if (!envResp.ok) {
      throw new Error(`Failed to fetch envelope: ${envResp.status}`);
    }
    
    const envData = await envResp.json();
    const recipients = envData.recipients || [];
    
    // Find investor and agent recipients
    let investorRecipientId = null;
    let agentRecipientId = null;
    
    for (const recipient of recipients) {
      const email = (recipient.email || '').toLowerCase();
      
      // Try to match based on role tabs or routing order
      if (recipient.routingOrder === '1') {
        investorRecipientId = recipient.recipientId;
        console.log('[fixAgreementRecipientIds] Investor recipient ID:', investorRecipientId);
      } else if (recipient.routingOrder === '2') {
        agentRecipientId = recipient.recipientId;
        console.log('[fixAgreementRecipientIds] Agent recipient ID:', agentRecipientId);
      }
    }
    
    if (!investorRecipientId || !agentRecipientId) {
      return Response.json({ 
        error: 'Could not determine recipient IDs from envelope',
        recipients: recipients.map(r => ({ recipientId: r.recipientId, routingOrder: r.routingOrder, email: r.email }))
      }, { status: 400 });
    }
    
    // Update agreement with recipient IDs
    if (isLegacy) {
      await base44.asServiceRole.entities.LegalAgreement.update(agreementId, {
        investor_recipient_id: investorRecipientId,
        agent_recipient_id: agentRecipientId
      });
    } else {
      await base44.asServiceRole.entities.AgreementVersion.update(agreementId, {
        investor_recipient_id: investorRecipientId,
        agent_recipient_id: agentRecipientId
      });
    }
    
    console.log('[fixAgreementRecipientIds] ✓ Updated agreement with recipient IDs');
    return Response.json({ success: true, investor_recipient_id: investorRecipientId, agent_recipient_id: agentRecipientId, isLegacy });
    
  } catch (error) {
    console.error('[fixAgreementRecipientIds] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});