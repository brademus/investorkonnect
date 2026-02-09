import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Replaces the placeholder agent signer (recipientId=2) on the investor's existing
 * DocuSign envelope with the real agent's details.
 * The envelope ALWAYS has both signers from generation — this just swaps the placeholder.
 */

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections?.length) throw new Error('DocuSign not connected');
  let conn = connections[0];
  if (conn.expires_at && new Date() >= new Date(conn.expires_at) && conn.refresh_token) {
    const tokenUrl = conn.base_uri.includes('demo') ? 'https://account-d.docusign.com/oauth/token' : 'https://account.docusign.com/oauth/token';
    const resp = await fetch(tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token, client_id: Deno.env.get('DOCUSIGN_INTEGRATION_KEY'), client_secret: Deno.env.get('DOCUSIGN_CLIENT_SECRET') })
    });
    if (!resp.ok) throw new Error('Token refresh failed');
    const tokens = await resp.json();
    const exp = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await base44.asServiceRole.entities.DocuSignConnection.update(conn.id, { access_token: tokens.access_token, refresh_token: tokens.refresh_token || conn.refresh_token, expires_at: exp });
    conn.access_token = tokens.access_token;
  } else if (conn.expires_at && new Date() >= new Date(conn.expires_at)) {
    throw new Error('DocuSign token expired');
  }
  return conn;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { agreement_id, room_id } = await req.json();
    if (!agreement_id) return Response.json({ error: 'agreement_id required' }, { status: 400 });

    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    const agreement = agreements?.[0];
    if (!agreement) return Response.json({ error: 'Agreement not found' }, { status: 404 });

    const envelopeId = agreement.docusign_envelope_id;
    if (!envelopeId) return Response.json({ error: 'No DocuSign envelope on this agreement' }, { status: 400 });

    // Resolve agent from room
    const effectiveRoomId = room_id || agreement.room_id;
    if (!effectiveRoomId) return Response.json({ error: 'room_id required to identify agent' }, { status: 400 });

    const rooms = await base44.asServiceRole.entities.Room.filter({ id: effectiveRoomId });
    const room = rooms?.[0];
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    // Find which agent is calling
    const callerProfiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const callerProfile = callerProfiles?.[0];
    if (!callerProfile) return Response.json({ error: 'Profile not found' }, { status: 403 });

    const agentId = callerProfile.id;
    if (!room.agent_ids?.includes(agentId)) return Response.json({ error: 'You are not an agent in this room' }, { status: 403 });

    const agent = callerProfile;

    // If this agent is ALREADY the real recipient on the envelope, skip
    if (agreement.agent_profile_id === agentId && agreement.agent_client_user_id && agreement.agent_recipient_id) {
      console.log('[addAgentToEnvelope] Agent already set on this agreement, skipping');
      return Response.json({ agreement });
    }

    const conn = await getDocuSignConnection(base44);
    const agentClientId = `ag-${agreement.deal_id}-${Date.now()}`;

    // The envelope was generated with a placeholder agent at recipientId=2.
    // Strategy: DELETE the placeholder recipient, then ADD the real agent with the same recipientId.
    const recipientsUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${envelopeId}/recipients`;

    // Check current envelope status
    const envStatusUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${envelopeId}`;
    const envResp = await fetch(envStatusUrl, { headers: { 'Authorization': `Bearer ${conn.access_token}` } });
    const envData = envResp.ok ? await envResp.json() : {};
    console.log('[addAgentToEnvelope] Envelope status:', envData.status);

    if (['voided', 'declined'].includes(envData.status)) {
      return Response.json({ error: 'Envelope is voided/declined. Please regenerate.' }, { status: 400 });
    }

    // The envelope should NEVER be completed at this point because the placeholder agent
    // uses a unique fake email, so DocuSign keeps the envelope open after investor signs.
    if (envData.status === 'completed') {
      console.error('[addAgentToEnvelope] Envelope unexpectedly completed — both signers already signed?');
      return Response.json({ error: 'Envelope already completed. Please regenerate.' }, { status: 400 });
    }

    // Get the current placeholder agent recipient
    const recipResp = await fetch(recipientsUrl, { headers: { 'Authorization': `Bearer ${conn.access_token}` } });
    const recipData = recipResp.ok ? await recipResp.json() : {};
    const existingAgentSigner = (recipData.signers || []).find(s => String(s.recipientId) === String(agreement.agent_recipient_id || '2'));

    if (existingAgentSigner) {
      // Delete the placeholder
      console.log('[addAgentToEnvelope] Removing placeholder agent signer:', existingAgentSigner.email);
      const deleteResp = await fetch(recipientsUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signers: [{ recipientId: String(agreement.agent_recipient_id || '2') }] })
      });
      if (!deleteResp.ok) {
        const delErr = await deleteResp.text();
        console.error('[addAgentToEnvelope] Failed to delete placeholder:', delErr);
        // If delete fails, try to just add — DocuSign may allow updating in place
      }
    }

    // Add the real agent as a new signer with the same recipientId
    const agentRecipientId = String(agreement.agent_recipient_id || '2');
    const addPayload = {
      signers: [{
        email: agent.email,
        name: agent.full_name || agent.email,
        recipientId: agentRecipientId,
        routingOrder: agentRecipientId,
        clientUserId: agentClientId,
        tabs: {
          signHereTabs: [{ documentId: '1', anchorString: '[[AGENT_SIGN]]', anchorUnits: 'pixels' }],
          dateSignedTabs: [{ documentId: '1', anchorString: '[[AGENT_DATE]]', anchorUnits: 'pixels' }],
          fullNameTabs: [{ documentId: '1', anchorString: '[[AGENT_PRINT]]', anchorUnits: 'pixels', value: agent.full_name || agent.email, locked: true, required: true, tabLabel: 'agentFullName' }],
          textTabs: [
            { documentId: '1', anchorString: '[[AGENT_LICENSE]]', anchorUnits: 'pixels', value: agent.agent?.license_number || agent.license_number || '', required: true, tabLabel: 'agentLicense' },
            { documentId: '1', anchorString: '[[AGENT_BROKERAGE]]', anchorUnits: 'pixels', value: agent.agent?.brokerage || agent.broker || '', required: true, tabLabel: 'agentBrokerage' }
          ]
        }
      }]
    };

    console.log('[addAgentToEnvelope] Adding real agent', agent.email, 'as recipientId', agentRecipientId);
    const addResp = await fetch(recipientsUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(addPayload)
    });

    if (!addResp.ok) {
      const errText = await addResp.text();
      console.error('[addAgentToEnvelope] DocuSign add error:', errText);
      return Response.json({ error: 'Failed to add agent to envelope: ' + errText }, { status: 500 });
    }

    const addResult = await addResp.json();
    console.log('[addAgentToEnvelope] Add result:', JSON.stringify(addResult));

    // Update agreement — same envelope ID, just updated agent details
    const updates = {
      agent_recipient_id: agentRecipientId,
      agent_client_user_id: agentClientId,
      agent_profile_id: agent.id,
      agent_user_id: agent.user_id,
      signer_mode: 'both'
    };

    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
    const updatedAgreement = { ...agreement, ...updates };

    console.log('[addAgentToEnvelope] Updated agreement', agreement.id, 'with real agent data on SAME envelope:', envelopeId);

    return Response.json({ agreement: updatedAgreement });
  } catch (error) {
    console.error('[addAgentToEnvelope] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});