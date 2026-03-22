import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DOCUSIGN_INTEGRATION_KEY = Deno.env.get('DOCUSIGN_INTEGRATION_KEY');
const DOCUSIGN_CLIENT_SECRET = Deno.env.get('DOCUSIGN_CLIENT_SECRET');

async function getDocuSignConnection(base44) {
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!connections?.length) throw new Error('DocuSign not connected');
  let conn = connections[0];
  if (conn.expires_at && new Date() >= new Date(conn.expires_at) && conn.refresh_token) {
    const tokenUrl = conn.base_uri.includes('demo') ? 'https://account-d.docusign.com/oauth/token' : 'https://account.docusign.com/oauth/token';
    const resp = await fetch(tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token, client_id: DOCUSIGN_INTEGRATION_KEY, client_secret: DOCUSIGN_CLIENT_SECRET })
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
  if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_CLIENT_SECRET) {
    console.error('[docusignCreateSigningSession] CRITICAL: Missing DocuSign credentials.');
    return Response.json({ error: 'DocuSign configuration error. Please contact support.', code: 'DOCUSIGN_CONFIG_MISSING' }, { status: 500 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { agreement_id, role, redirect_url, room_id } = await req.json();
    if (!agreement_id || !role || !['investor', 'agent'].includes(role)) {
      return Response.json({ error: 'agreement_id and role (investor/agent) required' }, { status: 400 });
    }

    // ── PHASE 1: Load agreement + DocuSign connection in parallel ──
    const [agreements, conn] = await Promise.all([
      base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id }),
      getDocuSignConnection(base44),
    ]);
    const agreement = agreements?.[0];
    if (!agreement) return Response.json({ error: 'Agreement not found' }, { status: 404 });
    if (['superseded', 'voided'].includes(agreement.status)) {
      return Response.json({ error: 'Agreement superseded. Please regenerate.' }, { status: 400 });
    }

    const signerMode = agreement.signer_mode || 'both';

    // Signer mode gating
    if (signerMode === 'agent_only' && role === 'investor') return Response.json({ error: 'This is an agent-only agreement' }, { status: 403 });
    if (signerMode === 'investor_only' && role === 'agent') {
      if (!agreement.agent_recipient_id || !agreement.agent_client_user_id) {
        return Response.json({ error: 'Agent must be added to envelope first. Please try again.' }, { status: 403 });
      }
    }

    // Quick already-signed check from local data BEFORE any DocuSign API calls
    if (role === 'investor' && agreement.investor_signed_at) return Response.json({ already_signed: true, agreement });
    if (role === 'agent' && agreement.agent_signed_at) return Response.json({ already_signed: true, agreement });
    if (role === 'agent' && !agreement.investor_signed_at && signerMode !== 'agent_only') {
      return Response.json({ error: 'Investor must sign first' }, { status: 403 });
    }

    // Check recipient data before doing any more work
    const recipientId = role === 'investor' ? agreement.investor_recipient_id : agreement.agent_recipient_id;
    const clientUserId = role === 'investor' ? agreement.investor_client_user_id : agreement.agent_client_user_id;
    if (!recipientId || !clientUserId) return Response.json({ error: `Missing recipient data for ${role}. Regenerate.` }, { status: 400 });

    // ── PHASE 2: Run room check, deal lock check, profile lookup, and envelope status ALL in parallel ──
    const effectiveRoom = room_id || agreement.room_id;
    const profileId = role === 'investor' ? agreement.investor_profile_id : agreement.agent_profile_id;

    const [roomResult, dealResult, profileResult, envResult] = await Promise.all([
      // Room regen check (only needed for investor)
      (effectiveRoom && role === 'investor')
        ? base44.asServiceRole.entities.Room.filter({ id: effectiveRoom }).catch(() => [])
        : Promise.resolve(null),
      // Deal lock check
      base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id }).catch(() => []),
      // Profile for signing
      base44.asServiceRole.entities.Profile.filter({ id: profileId }).catch(() => []),
      // Envelope status from DocuSign
      fetch(`${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${agreement.docusign_envelope_id}`, {
        headers: { 'Authorization': `Bearer ${conn.access_token}` }
      }).catch(() => null),
    ]);

    // Process room regen check
    if (roomResult && role === 'investor') {
      const rm = roomResult[0];
      if (rm?.requires_regenerate && rm.current_legal_agreement_id === agreement.id && !agreement.investor_signed_at) {
        return Response.json({ error: 'Terms changed. Regenerate agreement first.', code: 'REGENERATE_REQUIRED' }, { status: 400 });
      }
    }

    // Process deal lock check
    const deal = dealResult?.[0];
    if (deal?.locked_room_id && (room_id || agreement.room_id) && deal.locked_room_id !== (room_id || agreement.room_id)) {
      return Response.json({ error: 'Deal locked to another agent' }, { status: 403 });
    }

    // Process envelope status
    if (envResult?.ok) {
      const env = await envResult.json();
      console.log('[signing] Envelope status:', env.status, 'for role:', role);
      if (env.status === 'completed') {
        // Envelope is completed — update agreement status if it's stale
        if (agreement.status !== 'fully_signed') {
          const updates = { status: 'fully_signed', docusign_status: 'completed' };
          if (!agreement.investor_signed_at) updates.investor_signed_at = new Date().toISOString();
          if (!agreement.agent_signed_at) updates.agent_signed_at = new Date().toISOString();
          await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates).catch(() => {});
          Object.assign(agreement, updates);
        }
        return Response.json({ already_signed: true, agreement });
      }
      if (['voided', 'declined'].includes(env.status)) return Response.json({ error: `Envelope ${env.status}. Regenerate.` }, { status: 400 });
    }

    const profile = profileResult?.[0];

    // ── PHASE 3: Create signing token + recipient view in parallel ──
    const publicUrl = Deno.env.get('PUBLIC_APP_URL') || new URL(req.url).origin;
    const tokenValue = crypto.randomUUID();

    const returnURL = new URL(`${publicUrl}/DocuSignReturn`);
    returnURL.searchParams.set('token', tokenValue);
    if (agreement.deal_id) returnURL.searchParams.set('dealId', agreement.deal_id);
    if (room_id || agreement.room_id) returnURL.searchParams.set('roomId', room_id || agreement.room_id);
    returnURL.searchParams.set('role', role);

    const [_, viewResp] = await Promise.all([
      // Create signing token (fire and forget — don't block on it)
      base44.asServiceRole.entities.SigningToken.create({
        token: tokenValue, deal_id: agreement.deal_id, agreement_id: agreement.id,
        role, return_to: redirect_url || `${publicUrl}/Room?roomId=${room_id || agreement.room_id}&signed=1`,
        expires_at: new Date(Date.now() + 3600000).toISOString(), used: false
      }),
      // Create recipient view (the actual signing URL)
      fetch(`${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${agreement.docusign_envelope_id}/views/recipient`, {
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
      }),
    ]);

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