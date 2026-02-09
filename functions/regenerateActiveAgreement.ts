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
    const { deal_id, room_id, target_agent_id: explicitTargetAgentId } = body;
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
    let targetAgentId = explicitTargetAgentId || null;
    if (!targetAgentId && room_id && room) {
      // Find agents whose counter was accepted (requires_regenerate flag in agent_terms)
      const agTerms = room.agent_terms || {};
      for (const [agId, terms] of Object.entries(agTerms)) {
        if (terms?.requires_regenerate) {
          targetAgentId = agId;
          break;
        }
      }
      // Fallback: Find the DealInvite for this room to get the specific agent
      if (!targetAgentId) {
        const invites = await base44.asServiceRole.entities.DealInvite.filter({
          deal_id: deal_id,
          room_id: room_id
        });
        if (invites?.length === 1) targetAgentId = invites[0].agent_profile_id;
      }
      // Fallback: single agent in room
      if (!targetAgentId && room.agent_ids?.length === 1) targetAgentId = room.agent_ids[0];
    }
    console.log('[regenerate] targetAgentId:', targetAgentId);

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

    // Determine signer mode — always 'both' so investor and agent sign the SAME envelope.
    // The agent is added as routingOrder 2, so they can only sign after the investor.
    const signerMode = 'both';

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
      agent_profile_id: targetAgentId || null, // Ensure the correct agent is included in the envelope
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

    // Update room + clear regenerate flag
    // CRITICAL: Do NOT update room.current_legal_agreement_id to the regenerated agreement.
    // The room pointer should stay on the original investor-signed agreement so other agents
    // who didn't counter-offer still see (and can sign) the original agreement.
    // Instead, update the specific agent's DealInvite.legal_agreement_id.
    if (room_id && room) {
      const update = { agreement_status: 'draft' };
      if (room.requires_regenerate) update.requires_regenerate = false;
      
      // Clear per-agent requires_regenerate flag and update agreement status
      if (targetAgentId) {
        const updatedTerms = { ...(room.agent_terms || {}) };
        if (updatedTerms[targetAgentId]) {
          updatedTerms[targetAgentId] = { ...updatedTerms[targetAgentId], requires_regenerate: false };
        }
        update.agent_terms = updatedTerms;
        
        const updatedStatus = { ...(room.agent_agreement_status || {}) };
        updatedStatus[targetAgentId] = 'draft';
        update.agent_agreement_status = updatedStatus;
      }
      
      await base44.asServiceRole.entities.Room.update(room_id, update);
      
      // Update the specific agent's DealInvite to point to the new agreement
      if (targetAgentId) {
        const agentInvites = await base44.asServiceRole.entities.DealInvite.filter({
          deal_id: deal_id,
          agent_profile_id: targetAgentId
        });
        if (agentInvites?.[0]) {
          await base44.asServiceRole.entities.DealInvite.update(agentInvites[0].id, {
            legal_agreement_id: agreement.id
          });
          console.log('[regenerate] Updated DealInvite', agentInvites[0].id, 'legal_agreement_id to', agreement.id);
        }
      }
    }

    return Response.json({ success: true, agreement });
  } catch (error) {
    console.error('[regenerate] Error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});