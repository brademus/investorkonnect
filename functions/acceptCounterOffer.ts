import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ACCEPT COUNTER OFFER
 * Investor or agent accepts a counter offer
 * Marks counter as accepted and generates new agreement with updated terms
 * ONLY for the specific agent's room - doesn't affect other agents
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];

    const body = await req.json();
    const { counter_id } = body;

    if (!counter_id) {
      return Response.json({ error: 'Missing counter_id' }, { status: 400 });
    }

    // Get counter
    const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_id });
    const counter = counters[0];
    if (!counter) {
      return Response.json({ error: 'Counter offer not found' }, { status: 404 });
    }

    if (counter.status !== 'pending') {
      return Response.json({ error: 'Counter offer no longer pending' }, { status: 400 });
    }

    // Get room
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: counter.room_id });
    const room = rooms[0];
    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify user is the recipient
    const isInvestor = room.investorId === profile.id;
    const isAgent = room.agent_ids?.includes(profile.id);
    if (!isInvestor && !isAgent) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const userRole = isInvestor ? 'investor' : 'agent';
    if (counter.to_role !== userRole) {
      return Response.json({ error: 'Not the recipient of this counter' }, { status: 403 });
    }

    console.log('[acceptCounterOffer] Accepting counter:', counter_id);

    // Mark counter as accepted
    await base44.asServiceRole.entities.CounterOffer.update(counter_id, {
      status: 'accepted',
      responded_at: new Date().toISOString(),
      responded_by_role: userRole
    });

    // Get base agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({
      deal_id: counter.deal_id
    });
    const baseAgreement = agreements.find(a => !a.room_id);

    if (!baseAgreement) {
      return Response.json({ error: 'Base agreement not found' }, { status: 404 });
    }

    // Void any existing room-specific agreement
    const roomAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({
      deal_id: counter.deal_id,
      room_id: counter.room_id
    });
    for (const ag of roomAgreements) {
      await base44.asServiceRole.entities.LegalAgreement.update(ag.id, {
        status: 'voided'
      });
    }

    // Generate NEW agreement with updated terms (ONLY for this room)
    const newTerms = {
      ...baseAgreement.exhibit_a_terms,
      ...counter.terms_delta
    };

    // CRITICAL: Pass the specific agent_profile_id for this room
    // This ensures the agreement is generated ONLY for this agent, not others
    const agentId = room.agent_ids?.[0];
    
    const generateRes = await base44.asServiceRole.functions.invoke('generateLegalAgreement', {
      deal_id: counter.deal_id,
      room_id: counter.room_id,
      investor_profile_id: room.investorId,
      agent_profile_id: agentId, // Specific agent for this agreement
      agent_profile_ids: [agentId], // Keep for backward compatibility
      exhibit_a: newTerms,
      signer_mode: userRole === 'investor' ? 'investor_only' : 'agent_only'
    });

    if (generateRes.data?.error) {
      return Response.json({ error: generateRes.data.error }, { status: 500 });
    }

    const newAgreement = generateRes.data?.agreement;
    if (!newAgreement?.id) {
      return Response.json({ error: 'Failed to generate new agreement' }, { status: 500 });
    }

    // Update room with new agreement AND the new terms
    // CRITICAL: Store terms in agent_terms[agentId] to keep them agent-specific
    // This ensures other agents in other rooms don't see these negotiated terms
    const updatedAgentTerms = {
      ...(room.agent_terms || {}),
      [agentId]: newTerms
    };
    
    await base44.asServiceRole.entities.Room.update(counter.room_id, {
      current_legal_agreement_id: newAgreement.id,
      agreement_status: 'draft',
      // Store agent-specific negotiated terms
      agent_terms: updatedAgentTerms,
      // Also store in proposed_terms for backward compatibility with UI
      proposed_terms: newTerms
    });

    console.log('[acceptCounterOffer] Generated new agreement:', newAgreement.id, 'with terms:', newTerms);

    // Fetch the full new agreement to return to frontend
    const fullAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: newAgreement.id });
    const fullAgreement = fullAgreements[0] || newAgreement;

    return Response.json({
      success: true,
      new_agreement_id: newAgreement.id,
      agreement: fullAgreement,
      new_terms: newTerms,
      needs_signature_from: userRole === 'investor' ? 'investor' : 'agent'
    });
  } catch (error) {
    console.error('[acceptCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});