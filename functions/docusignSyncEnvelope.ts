import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections?.length) throw new Error('DocuSign not connected');
  return connections[0];
}

/**
 * Simple sync: update agreement signatures from DocuSign
 * Input: { deal_id }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { deal_id } = await req.json();
    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });

    // Get latest agreement for deal
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter(
      { deal_id },
      '-created_date',
      1
    );
    if (!agreements?.length) return Response.json({ error: 'Agreement not found' }, { status: 404 });

    const agreement = agreements[0];
    const envelopeId = agreement.docusign_envelope_id;
    if (!envelopeId) return Response.json({ error: 'No envelope' }, { status: 400 });

    // Get DocuSign status
    const connection = await getDocuSignConnection(base44);
    const recipientsUrl = `${connection.base_uri}/restapi/v2.1/accounts/${connection.account_id}/envelopes/${envelopeId}/recipients`;
    
    const recipResp = await fetch(recipientsUrl, {
      headers: { 'Authorization': `Bearer ${connection.access_token}` }
    });

    if (!recipResp.ok) throw new Error('Failed to fetch recipients');

    const recipData = await recipResp.json();
    const signers = recipData.signers || [];

    // Match signers by recipient ID
    const invSigner = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id));
    const agentSigner = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id));

    const invCompleted = invSigner?.status === 'completed';
    const agCompleted = agentSigner?.status === 'completed';

    // Update agreement
    const updates = {};
    const now = new Date().toISOString();

    if (invCompleted && !agreement.investor_signed_at) {
      updates.investor_signed_at = invSigner.signedDateTime || now;
    }

    if (agCompleted && !agreement.agent_signed_at) {
      updates.agent_signed_at = agentSigner.signedDateTime || now;
    }

    // Determine status
    if (invCompleted && agCompleted) {
      updates.status = 'fully_signed';
    } else if (invCompleted) {
      updates.status = 'investor_signed';
    } else if (agCompleted) {
      updates.status = 'agent_signed';
    }

    // Update DB
    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
      console.log('[docusignSyncEnvelope] Updated with status:', updates.status);
    }

    // Return fresh agreement
    const fresh = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement.id });
    return Response.json({ success: true, agreement: fresh[0] });
  } catch (error) {
    console.error('[docusignSyncEnvelope]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});