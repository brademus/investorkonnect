import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * AGENT SIGN AND WIN DEAL
 * Called when agent signs their agreement
 * First agent to sign wins the deal
 * Locks the deal to this agent and removes all other agents
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
    if (!profile || profile.user_role !== 'agent') {
      return Response.json({ error: 'Only agents can sign' }, { status: 403 });
    }

    const body = await req.json();
    const { deal_id, room_id, agreement_id } = body;

    if (!deal_id || !room_id || !agreement_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    const deal = deals[0];
    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Check if deal already locked
    if (deal.locked_agent_id) {
      return Response.json({ 
        error: 'Deal already locked to another agent',
        locked: true 
      }, { status: 400 });
    }

    // Get room
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
    const room = rooms[0];
    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify agent is in this room
    if (!room.agent_ids?.includes(profile.id)) {
      return Response.json({ error: 'Not authorized for this room' }, { status: 403 });
    }

    // Get agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    const agreement = agreements[0];
    if (!agreement?.agent_signed_at) {
      return Response.json({ error: 'Agreement not signed yet' }, { status: 400 });
    }

    console.log('[agentSignAndWinDeal] Agent', profile.id, 'signing and winning deal', deal_id);

    // Lock deal to this agent (atomic operation)
    await base44.asServiceRole.entities.Deal.update(deal.id, {
      locked_agent_id: profile.id,
      locked_room_id: room_id,
      connected_at: new Date().toISOString(),
      pipeline_stage: 'connected_deals',
      agent_id: profile.id
    });

    // Update winning room
    await base44.asServiceRole.entities.Room.update(room_id, {
      request_status: 'locked',
      agreement_status: 'fully_signed',
      locked_agent_id: profile.id,
      locked_at: new Date().toISOString()
    });

    // Update winning invite
    const winningInvites = await base44.asServiceRole.entities.DealInvite.filter({ 
      deal_id: deal.id,
      agent_profile_id: profile.id 
    });
    if (winningInvites[0]) {
      await base44.asServiceRole.entities.DealInvite.update(winningInvites[0].id, {
        status: 'LOCKED'
      });
    }

    // Get all rooms for this deal
    const allRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
    
    // Delete all OTHER rooms and invites
    for (const r of allRooms) {
      if (r.id !== room_id) {
        // Void the room
        await base44.asServiceRole.entities.Room.update(r.id, {
          request_status: 'voided'
        });

        // Delete invites for other agents
        const otherInvites = await base44.asServiceRole.entities.DealInvite.filter({
          room_id: r.id
        });
        for (const invite of otherInvites) {
          await base44.asServiceRole.entities.DealInvite.update(invite.id, {
            status: 'VOIDED'
          });
        }

        console.log('[agentSignAndWinDeal] Voided room:', r.id);
      }
    }

    // Create activity
    await base44.asServiceRole.entities.Activity.create({
      type: 'agent_locked_in',
      deal_id: deal.id,
      room_id: room_id,
      actor_id: profile.id,
      actor_name: profile.full_name,
      message: `${profile.full_name} signed and is now working with the investor`
    });

    console.log('[agentSignAndWinDeal] Deal locked to agent:', profile.id);

    return Response.json({
      success: true,
      deal_id: deal.id,
      room_id: room_id,
      locked_agent_id: profile.id
    });
  } catch (error) {
    console.error('[agentSignAndWinDeal] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});