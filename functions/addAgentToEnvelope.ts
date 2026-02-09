import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Adds the agent as a signer (recipientId=2) to the investor's existing DocuSign envelope.
 * This way agent signs the SAME document / envelope the investor already signed.
 * Updates the LegalAgreement record with agent recipient info.
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

    // If agent is already a recipient, just return the agreement as-is
    if (agreement.agent_recipient_id && agreement.agent_client_user_id) {
      console.log('[addAgentToEnvelope] Agent already has recipient data, skipping');
      return Response.json({ agreement });
    }

    const envelopeId = agreement.docusign_envelope_id;
    if (!envelopeId) return Response.json({ error: 'No DocuSign envelope on this agreement' }, { status: 400 });

    // Resolve agent from room
    const effectiveRoomId = room_id || agreement.room_id;
    if (!effectiveRoomId) return Response.json({ error: 'room_id required to identify agent' }, { status: 400 });

    const rooms = await base44.asServiceRole.entities.Room.filter({ id: effectiveRoomId });
    const room = rooms?.[0];
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    // Find which agent is calling (from DealInvite or room.agent_ids)
    const callerProfiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const callerProfile = callerProfiles?.[0];
    if (!callerProfile) return Response.json({ error: 'Profile not found' }, { status: 403 });

    // Confirm caller is one of the agents in the room
    const agentId = callerProfile.id;
    if (!room.agent_ids?.includes(agentId)) return Response.json({ error: 'You are not an agent in this room' }, { status: 403 });

    // Load agent profile for signing details
    const agent = callerProfile;
    const conn = await getDocuSignConnection(base44);

    // Generate a unique client user ID for the agent
    const agentClientId = `ag-${agreement.deal_id}-${Date.now()}`;

    // Add agent as a new recipient to the existing envelope via DocuSign API
    const addRecipientUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${envelopeId}/recipients`;
    
    const recipientPayload = {
      signers: [{
        email: agent.email,
        name: agent.full_name || agent.email,
        recipientId: '2',
        routingOrder: '2',
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

    console.log('[addAgentToEnvelope] Adding agent', agent.email, 'to envelope', envelopeId);

    const addResp = await fetch(addRecipientUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(recipientPayload)
    });

    if (!addResp.ok) {
      const errText = await addResp.text();
      console.error('[addAgentToEnvelope] DocuSign error:', errText);
      return Response.json({ error: 'Failed to add agent to envelope: ' + errText }, { status: 500 });
    }

    const addResult = await addResp.json();
    console.log('[addAgentToEnvelope] DocuSign add recipient result:', JSON.stringify(addResult));

    // Update the agreement with agent recipient info
    const updates = {
      agent_recipient_id: '2',
      agent_client_user_id: agentClientId,
      agent_profile_id: agent.id,
      agent_user_id: agent.user_id,
      signer_mode: 'both' // Now it's a both-signer agreement
    };

    await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
    const updatedAgreement = { ...agreement, ...updates };

    console.log('[addAgentToEnvelope] Updated agreement', agreement.id, 'with agent recipient data');

    return Response.json({ agreement: updatedAgreement });
  } catch (error) {
    console.error('[addAgentToEnvelope] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});