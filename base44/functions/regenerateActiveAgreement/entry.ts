import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Regenerate agreement for a deal (after counter offer accepted, or agent needs to sign).
 * Since each deal is now per-agent, terms come directly from deal.proposed_terms.
 * No complex agent_terms resolution needed.
 */
Deno.serve(async (req) => {
  console.log('[regenerate v7] START');
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

    // Load deal + room + caller profile
    const [deals, rooms, profiles] = await Promise.all([
      base44.asServiceRole.entities.Deal.filter({ id: deal_id }),
      room_id ? base44.asServiceRole.entities.Room.filter({ id: room_id }) : Promise.resolve([]),
      base44.asServiceRole.entities.Profile.filter({ user_id: user.id })
    ]);

    const deal = deals?.[0];
    const room = rooms?.[0];
    const caller = profiles?.[0];
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });
    if (!caller) return Response.json({ error: 'Profile not found' }, { status: 403 });

    // The agent is the deal's assigned agent
    const targetAgentId = deal.agent_id || room?.agent_ids?.[0] || null;
    console.log('[regenerate] targetAgentId:', targetAgentId, 'deal:', deal_id);

    // Resolve agent-specific counter terms from room.agent_terms if available
    // Fall back to deal.proposed_terms only if no agent-specific counter terms exist
    let terms = deal.proposed_terms || {};
    if (room && targetAgentId && room.agent_terms?.[targetAgentId]) {
      const agentTermEntry = room.agent_terms[targetAgentId];
      // Only use agent_terms if this agent has a counter that was accepted
      if (agentTermEntry.requires_regenerate || agentTermEntry.counter_offer_id) {
        terms = {
          ...terms,               // start with original deal terms
          ...agentTermEntry,      // overlay agent-specific counter terms
        };
        // Strip internal flags from terms object before using
        delete terms.requires_regenerate;
        delete terms.counter_offer_id;
        console.log('[regenerate] Using agent-specific counter terms for:', targetAgentId);
      }
    }

    if (!terms.buyer_commission_type && !terms.seller_commission_type) {
      return Response.json({ error: 'Missing commission terms' }, { status: 400 });
    }
    if (!terms.buyer_commission_type) terms.buyer_commission_type = 'percentage';
    
    console.log('[regenerate] Using terms:', JSON.stringify(terms));

    // Signer mode — always 'both' so investor and agent sign the SAME envelope
    const signerMode = 'both';

    // Resolve investor profile ID from deal
    const investorId = deal.investor_id || room?.investorId || caller.id;
    let investorUserId = null;
    if (investorId) {
      const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: investorId });
      investorUserId = investorProfiles?.[0]?.user_id || null;
    }

    const payload = {
      deal_id, room_id: room_id || null,
      signer_mode: signerMode,
      agent_profile_id: targetAgentId || null,
      exhibit_a: {
        seller_commission_type: terms.seller_commission_type || 'percentage',
        seller_commission_percentage: terms.seller_commission_percentage ?? null,
        seller_flat_fee: terms.seller_flat_fee ?? null,
        buyer_commission_type: terms.buyer_commission_type || 'percentage',
        buyer_commission_percentage: terms.buyer_commission_percentage ?? null,
        buyer_flat_fee: terms.buyer_flat_fee ?? null,
        agreement_length_days: terms.agreement_length || terms.agreement_length_days || 180,
        transaction_type: terms.transaction_type || 'ASSIGNMENT'
      },
      investor_profile_id: investorId,
      investor_user_id: investorUserId,
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

    // Update deal: clear regenerate flag, point to new agreement
    await base44.asServiceRole.entities.Deal.update(deal_id, {
      current_legal_agreement_id: agreement.id,
      requires_regenerate: false,
      requires_regenerate_reason: null
    });

    // Update room if it exists — do NOT set current_legal_agreement_id
    // That keeps the original agreement accessible for other pending agents
    if (room_id && room) {
      const roomUpdate = { requires_regenerate: false };
      if (targetAgentId) {
        const updatedTerms = { ...(room.agent_terms || {}) };
        if (updatedTerms[targetAgentId]) {
          updatedTerms[targetAgentId] = {
            ...updatedTerms[targetAgentId],
            requires_regenerate: false,
            counter_offer_id: null,
            regenerated_agreement_id: agreement.id
          };
        }
        roomUpdate.agent_terms = updatedTerms;

        const updatedStatus = { ...(room.agent_agreement_status || {}) };
        updatedStatus[targetAgentId] = 'sent';
        roomUpdate.agent_agreement_status = updatedStatus;
      }
      await base44.asServiceRole.entities.Room.update(room_id, roomUpdate);
    }
    
    // Update DealInvite to point to new agreement
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

    return Response.json({ success: true, agreement });
  } catch (error) {
    console.error('[regenerate] Error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});