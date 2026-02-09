import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SEND COUNTER OFFER
 * Agent or investor sends a counter offer with new terms
 * Creates CounterOffer record with status=pending
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
    const { deal_id, room_id, new_terms } = body;

    if (!deal_id || !room_id || !new_terms) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get room
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
    const room = rooms[0];
    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify user is part of this room
    const isInvestor = room.investorId === profile.id;
    const isAgent = room.agent_ids?.includes(profile.id);
    if (!isInvestor && !isAgent) {
      return Response.json({ error: 'Not authorized for this room' }, { status: 403 });
    }

    const fromRole = isInvestor ? 'investor' : 'agent';
    const toRole = isInvestor ? 'agent' : 'investor';

    // Supersede any existing pending counters in this room FROM this specific profile
    // (not all pending counters — other agents may have their own pending counters)
    const existingCounters = await base44.asServiceRole.entities.CounterOffer.filter({
      room_id: room_id,
      status: 'pending'
    });
    for (const counter of existingCounters) {
      // Only supersede counters from the same profile (agent-specific)
      if (counter.from_profile_id === profile.id || (!counter.from_profile_id && counter.from_role === fromRole)) {
        await base44.asServiceRole.entities.CounterOffer.update(counter.id, {
          status: 'superseded'
        });
      }
    }

    // Create new counter offer with profile IDs for agent-specific tracking
    const counter = await base44.asServiceRole.entities.CounterOffer.create({
      deal_id,
      room_id,
      from_role: fromRole,
      to_role: toRole,
      from_profile_id: profile.id,
      status: 'pending',
      terms_delta: new_terms
    });

    console.log('[sendCounterOffer] Created counter:', counter.id);

    return Response.json({
      success: true,
      counter_id: counter.id
    });
  } catch (error) {
    console.error('[sendCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});