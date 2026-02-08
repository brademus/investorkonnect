import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const { agreement_id, role, redirect_url, room_id } = await req.json();
    if (!agreement_id || !role || !['investor', 'agent'].includes(role)) {
      return Response.json({ error: 'agreement_id and role (investor/agent) required' }, { status: 400 });
    }

    // Load agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    const agreement = agreements?.[0];
    if (!agreement) return Response.json({ error: 'Agreement not found' }, { status: 404 });
    if (['superseded', 'voided'].includes(agreement.status)) {
      return Response.json({ error: 'Agreement superseded. Please regenerate.' }, { status: 400 });
    }

    const signerMode = agreement.signer_mode || 'both';

    // Signer mode gating
    if (signerMode === 'agent_only' && role === 'investor') return Response.json({ error: 'This is an agent-only agreement' }, { status: 403 });
    if (signerMode === 'investor_only' && role === 'agent') return Response.json({ error: 'Agent needs a separate agreement' }, { status: 403 });

    // Room regenerate check
    const effectiveRoom = room_id || agreement.room_id;
    if (effectiveRoom && role === 'investor') {
      const r = await base44.asServiceRole.entities.Room.filter({ id: effectiveRoom });
      if (r?.[0]?.requires_regenerate && r[0].current_legal_agreement_id === agreement.id && !agreement.investor_signed_at) {
        return Response.json({ error: 'Terms changed. Regenerate agreement first.', code: 'REGENERATE_REQUIRED' }, { status: 400 });
      }
    }

    // Deal lock check
    const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
    const deal = dealArr?.[0];
    if (deal?.locked_room_id && (room_id || agreement.room_id) && deal.locked_room_id !== (room_id || agreement.room_id)) {
      return Response.json({ error: 'Deal locked to another agent' }, { status: 403 });
    }

    // Get DocuSign connection
    const conn = await getDocuSignConnection(base44);

    // Sync signatures from DocuSign
    const recipUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${agreement.docusign_envelope_id}/recipients`;
    const recipResp = await fetch(recipUrl, { headers: { 'Authorization': `Bearer ${conn.access_token}` } });
    if (recipResp.ok) {
      const recipData = await recipResp.json();
      const signers = recipData.signers || [];
      const updates = {};
      const inv = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id));
      const ag = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id));
      if (inv?.status === 'completed' && !agreement.investor_signed_at) updates.investor_signed_at = inv.signedDateTime || new Date().toISOString();
      if (ag?.status === 'completed' && !agreement.agent_signed_at) updates.agent_signed_at = ag.signedDateTime || new Date().toISOString();
      if (Object.keys(updates).length) {
        const invS = !!(updates.investor_signed_at || agreement.investor_signed_at);
        const agS = !!(updates.agent_signed_at || agreement.agent_signed_at);
        updates.status = invS && agS ? 'fully_signed' : invS ? 'investor_signed' : 'agent_signed';
        await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
        Object.assign(agreement, updates);
      }
    }

    // Already signed check
    if (role === 'investor' && agreement.investor_signed_at) return Response.json({ already_signed: true });
    if (role === 'agent' && agreement.agent_signed_at) return Response.json({ already_signed: true });
    if (signerMode === 'both' && role === 'agent' && !agreement.investor_signed_at) {
      return Response.json({ error: 'Investor must sign first' }, { status: 403 });
    }

    // Check envelope status
    const envUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${agreement.docusign_envelope_id}`;
    const envResp = await fetch(envUrl, { headers: { 'Authorization': `Bearer ${conn.access_token}` } });
    if (envResp.ok) {
      const env = await envResp.json();
      if (env.status === 'completed') return Response.json({ already_signed: true });
      if (['voided', 'declined'].includes(env.status)) return Response.json({ error: `Envelope ${env.status}. Regenerate.` }, { status: 400 });
    }

    // Build redirect URL
    const publicUrl = Deno.env.get('PUBLIC_APP_URL') || new URL(req.url).origin;
    const tokenValue = crypto.randomUUID();
    await base44.asServiceRole.entities.SigningToken.create({
      token: tokenValue, deal_id: agreement.deal_id, agreement_id: agreement.id,
      role, return_to: redirect_url || `${publicUrl}/Room?roomId=${room_id || agreement.room_id}&signed=1`,
      expires_at: new Date(Date.now() + 3600000).toISOString(), used: false
    });

    const returnURL = new URL(`${publicUrl}/DocuSignReturn`);
    returnURL.searchParams.set('token', tokenValue);
    if (agreement.deal_id) returnURL.searchParams.set('dealId', agreement.deal_id);
    if (room_id) returnURL.searchParams.set('roomId', room_id);
    returnURL.searchParams.set('role', role);

    // Get profile for signing
    const profileId = role === 'investor' ? agreement.investor_profile_id : agreement.agent_profile_id;
    const profileArr = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
    const profile = profileArr?.[0];

    const recipientId = role === 'investor' ? agreement.investor_recipient_id : agreement.agent_recipient_id;
    const clientUserId = role === 'investor' ? agreement.investor_client_user_id : agreement.agent_client_user_id;
    if (!recipientId || !clientUserId) return Response.json({ error: `Missing recipient data for ${role}. Regenerate.` }, { status: 400 });

    // Create signing view
    const viewResp = await fetch(`${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${agreement.docusign_envelope_id}/views/recipient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnUrl: returnURL.toString(),
        authenticationMethod: 'none',
        email: profile?.email || user.email,
        userName: profile?.full_name || user.email,
        recipientId: String(recipientId),
        clientUserId: String(clientUserId),
        frameAncestors: [publicUrl], messageOrigins: [publicUrl]
      })
    });

    if (!viewResp.ok) {
      const errText = await viewResp.text();
      if (errText.includes('OUT_OF_SEQUENCE')) return Response.json({ error: 'Investor must sign first' }, { status: 400 });
      return Response.json({ error: 'Signing session failed. Try regenerating.' }, { status: 500 });
    }

    const viewData = await viewResp.json();
    return Response.json({ signing_url: viewData.url });
  } catch (error) {
    console.error('[signing] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});