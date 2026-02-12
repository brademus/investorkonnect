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

/**
 * Pick the license number whose prefix matches the deal state.
 */
function pickLicenseForState(agentProfile, dealState) {
  const primary = agentProfile?.agent?.license_number || agentProfile?.license_number || '';
  const additional = agentProfile?.agent?.additional_license_numbers || [];
  const allLicenses = [primary, ...additional].filter(Boolean);
  if (!dealState || allLicenses.length === 0) return primary || '';
  const stateUpper = dealState.toUpperCase();
  const match = allLicenses.find(lic => {
    const prefix = lic.toUpperCase().replace(/[^A-Z0-9]/g, ' ').trim().split(/[\s\-]+/)[0];
    return prefix === stateUpper;
  });
  return match || primary || '';
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

    // Load deal to determine the state for license number matching
    let dealState = agreement.governing_state || '';
    if (!dealState && agreement.deal_id) {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
      if (deals?.[0]) dealState = deals[0].state || '';
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

    // If the envelope is already completed (legacy envelopes that used investor's email as
    // placeholder agent, causing DocuSign to auto-complete), we need to regenerate.
    // Return a special code so the frontend can trigger regeneration automatically.
    if (envData.status === 'completed') {
      console.log('[addAgentToEnvelope] Envelope completed (legacy placeholder issue). Returning regen code.');
      return Response.json({ 
        code: 'ENVELOPE_COMPLETED_REGEN_REQUIRED',
        error: 'Envelope already completed — regenerating for agent signing.'
      }, { status: 409 });
    }

    // Get the current placeholder agent recipient
    const agentRecipientId = String(agreement.agent_recipient_id || '2');
    const recipResp = await fetch(recipientsUrl, { headers: { 'Authorization': `Bearer ${conn.access_token}` } });
    const recipData = recipResp.ok ? await recipResp.json() : {};
    const existingAgentSigner = (recipData.signers || []).find(s => String(s.recipientId) === agentRecipientId);

    console.log('[addAgentToEnvelope] Existing agent signer:', existingAgentSigner?.email, 'status:', existingAgentSigner?.status);

    const agentLicenseForDeal = pickLicenseForState(agent, dealState);
    console.log('[addAgentToEnvelope] Picked license for state', dealState, ':', agentLicenseForDeal);

    const agentSignerPayload = {
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
          { documentId: '1', anchorString: '[[AGENT_LICENSE]]', anchorUnits: 'pixels', value: agentLicenseForDeal, required: 'true', locked: 'true', tabLabel: 'agentLicense' },
          { documentId: '1', anchorString: '[[AGENT_BROKERAGE]]', anchorUnits: 'pixels', value: agent.agent?.brokerage || agent.broker || '', required: 'true', locked: 'true', tabLabel: 'agentBrokerage' }
        ]
      }
    };

    let success = false;

    if (existingAgentSigner) {
      // Strategy 1: Use PUT to update the placeholder recipient in-place (preferred — no edit lock issues)
      console.log('[addAgentToEnvelope] Updating placeholder agent in-place via PUT:', existingAgentSigner.email, '->', agent.email);
      const putResp = await fetch(recipientsUrl, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signers: [agentSignerPayload] })
      });

      if (putResp.ok) {
        const putResult = await putResp.json();
        console.log('[addAgentToEnvelope] PUT result:', JSON.stringify(putResult));
        success = true;
      } else {
        const putErr = await putResp.text();
        console.warn('[addAgentToEnvelope] PUT failed, trying DELETE+POST fallback:', putErr);

        // Strategy 2: DELETE then POST (fallback)
        const deleteResp = await fetch(recipientsUrl, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ signers: [{ recipientId: agentRecipientId }] })
        });
        if (!deleteResp.ok) {
          console.error('[addAgentToEnvelope] DELETE also failed:', await deleteResp.text());
        }

        const postResp = await fetch(recipientsUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ signers: [agentSignerPayload] })
        });
        if (postResp.ok) {
          const postResult = await postResp.json();
          console.log('[addAgentToEnvelope] POST result:', JSON.stringify(postResult));
          success = true;
        } else {
          const postErr = await postResp.text();
          console.error('[addAgentToEnvelope] POST also failed:', postErr);
          return Response.json({ error: 'Failed to add agent to envelope: ' + postErr }, { status: 500 });
        }
      }
    } else {
      // No existing placeholder — just POST the new signer
      console.log('[addAgentToEnvelope] No existing placeholder, adding agent via POST:', agent.email);
      const postResp = await fetch(recipientsUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signers: [agentSignerPayload] })
      });
      if (!postResp.ok) {
        const postErr = await postResp.text();
        console.error('[addAgentToEnvelope] POST error:', postErr);
        return Response.json({ error: 'Failed to add agent to envelope: ' + postErr }, { status: 500 });
      }
      const postResult = await postResp.json();
      console.log('[addAgentToEnvelope] POST result:', JSON.stringify(postResult));
      success = true;
    }

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