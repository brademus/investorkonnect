import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * sendDealRequest - Investor sends a deal request to ONE agent
 * Creates a Room with status=requested
 * Only ONE agent can be in requested/accepted/signed state per deal at a time
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deal_id, agent_profile_id } = await req.json();

    if (!deal_id || !agent_profile_id) {
      return Response.json({ error: 'Missing deal_id or agent_profile_id' }, { status: 400 });
    }

    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const investorProfile = profiles[0];

    if (!investorProfile || investorProfile.user_role !== 'investor') {
      return Response.json({ error: 'Only investors can send deal requests' }, { status: 403 });
    }

    // Get deal
    const deals = await base44.entities.Deal.filter({ id: deal_id });
    const deal = deals[0];

    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (deal.investor_id !== investorProfile.id) {
      return Response.json({ error: 'Not your deal' }, { status: 403 });
    }

    // Check if deal already has an active agent (requested/accepted/signed)
    const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    const activeRoom = existingRooms.find(r => 
      r.request_status === 'requested' || 
      r.request_status === 'accepted' || 
      r.request_status === 'signed'
    );

    if (activeRoom) {
      return Response.json({ 
        error: 'Deal already has an active request', 
        room_id: activeRoom.id,
        status: activeRoom.request_status
      }, { status: 409 });
    }

    // Get agent profile
    const agentProfiles = await base44.entities.Profile.filter({ id: agent_profile_id });
    const agentProfile = agentProfiles[0];

    if (!agentProfile || agentProfile.user_role !== 'agent') {
      return Response.json({ error: 'Invalid agent' }, { status: 400 });
    }

    // Create room with status=requested
    const room = await base44.asServiceRole.entities.Room.create({
      deal_id,
      investorId: investorProfile.id,
      agentId: agent_profile_id,
      request_status: 'requested',
      requested_at: new Date().toISOString(),
      title: deal.title,
      city: deal.city,
      state: deal.state,
      county: deal.county,
      zip: deal.zip,
      budget: deal.purchase_price,
      closing_date: deal.key_dates?.closing_date
    });

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      type: 'deal_created',
      deal_id,
      room_id: room.id,
      actor_id: investorProfile.id,
      actor_name: investorProfile.full_name || investorProfile.email,
      message: `${investorProfile.full_name || investorProfile.email} sent deal request to ${agentProfile.full_name || agentProfile.email}`
    });

    return Response.json({ 
      success: true, 
      room_id: room.id,
      agent_name: agentProfile.full_name || agentProfile.email,
      status: 'requested'
    });

  } catch (error) {
    console.error('[sendDealRequest] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});