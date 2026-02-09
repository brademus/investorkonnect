import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Regenerate agreement for a room (after counter offer accepted, or agent needs to sign).
 * Resolves terms from room, determines signer_mode, then calls generateLegalAgreement via HTTP.
 */
Deno.serve(async (req) => {
  console.log('[regenerate v6] START');
  const rawBody = await req.text();
  const originalHeaders = new Headers(req.headers);

  try {
    const authReq = new Request(req.url, { method: req.method, headers: originalHeaders, body: rawBody });
    const base44 = createClientFromRequest(authReq);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = JSON.parse(rawBody);
    const { deal_id, room_id } = body;
    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });

    // Load room + deal
    const [rooms, deals, profiles] = await Promise.all([
      room_id ? base44.asServiceRole.entities.Room.filter({ id: room_id }) : Promise.resolve([]),
      base44.asServiceRole.entities.Deal.filter({ id: deal_id }),
      base44.asServiceRole.entities.Profile.filter({ user_id: user.id })
    ]);

    const room = rooms?.[0];
    const deal = deals?.[0];
    const caller = profiles?.[0];
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });
    if (!caller) return Response.json({ error: 'Profile not found' }, { status: 403 });

    // Resolve terms: prefer agent-specific terms over room.proposed_terms
    // Determine which agent this regeneration is for
    let targetAgentId = null;
    if (room_id && room) {
      // Find the DealInvite for this room to get the specific agent
      const invites = await base44.asServiceRole.entities.DealInvite.filter({
        deal_id: deal_id,
        room_id: room_id
      });
      if (invites?.[0]) targetAgentId = invites[0].agent_profile_id;
      // Fallback: single agent in room
      if (!targetAgentId && room.agent_ids?.length === 1) targetAgentId = room.agent_ids[0];
    }

    // Priority: agent-specific terms > room.proposed_terms > deal.proposed_terms
    let terms = {};
    if (targetAgentId && room?.agent_terms?.[targetAgentId]?.buyer_commission_type) {
      terms = room.agent_terms[targetAgentId];
      console.log('[regenerate] Using agent-specific terms for', targetAgentId, ':', JSON.stringify(terms));
    } else {
      terms = room?.proposed_terms || deal?.proposed_terms || {};
      console.log('[regenerate] Using room/deal proposed_terms:', JSON.stringify(terms));
    }
    if (!terms.buyer_commission_type) return Response.json({ error: 'Missing commission terms' }, { status: 400 });

    // Determine signer mode
    let signerMode = 'both';
    if (room?.requires_regenerate) signerMode = 'investor_only';
    else if (room_id) signerMode = 'agent_only';

    // CRITICAL: Always resolve the correct investor profile ID from the room/deal, NOT from the caller.
    // When an agent triggers regeneration, caller.id would be the agent — that's wrong for investor_profile_id.
    const investorId = room?.investorId || deal?.investor_id || caller.id;

    // Also resolve the correct investor user_id for the agreement record
    let investorUserId = null;
    if (investorId) {
      const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: investorId });
      investorUserId = investorProfiles?.[0]?.user_id || null;
    }

    const payload = {
      deal_id, room_id: room_id || null,
      signer_mode: signerMode,
      exhibit_a: {
        buyer_commission_type: terms.buyer_commission_type,
        buyer_commission_percentage: terms.buyer_commission_percentage || null,
        buyer_flat_fee: terms.buyer_flat_fee || null,
        agreement_length_days: terms.agreement_length || terms.agreement_length_days || 180,
        transaction_type: terms.transaction_type || 'ASSIGNMENT'
      },
      investor_profile_id: investorId,
      investor_user_id: investorUserId, // Pass explicit investor user_id
      property_address: deal.property_address, city: deal.city, state: deal.state, zip: deal.zip, county: deal.county
    };

    console.log('[regenerate] mode:', signerMode, 'payload keys:', Object.keys(payload));

    // Call generateLegalAgreement via HTTP (forwarding auth)
    const appId = Deno.env.get('BASE44_APP_ID');
    const headers = { 'Content-Type': 'application/json' };
    for (const [k, v] of originalHeaders.entries()) {
      if (['authorization', 'cookie'].includes(k.toLowerCase()) || k.toLowerCase().startsWith('x-base44')) headers[k] = v;
    }

    const resp = await fetch(`https://base44.app/api/apps/${appId}/functions/generateLegalAgreement`, {
      method: 'POST', headers, body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || data?.error) return Response.json({ error: data?.error || 'Generation failed' }, { status: resp.ok ? 400 : resp.status });

    const agreement = data?.agreement;
    if (!agreement?.id) return Response.json({ error: 'No agreement returned' }, { status: 500 });

    // Update room pointer + clear regenerate flag
    if (room_id && room) {
      const update = { current_legal_agreement_id: agreement.id, agreement_status: 'draft' };
      if (room.requires_regenerate) update.requires_regenerate = false;
      await base44.asServiceRole.entities.Room.update(room_id, update);
    }

    return Response.json({ success: true, agreement });
  } catch (error) {
    console.error('[regenerate] Error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});