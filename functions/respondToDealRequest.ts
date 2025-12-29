import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * respondToDealRequest - Agent accepts or rejects a deal request
 * Accept: status=requested → accepted, chat enabled
 * Reject: status=requested → rejected, investor goes back to agent match
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { room_id, action } = await req.json(); // action: 'accept' or 'reject'

    if (!room_id || !action) {
      return Response.json({ error: 'Missing room_id or action' }, { status: 400 });
    }

    if (action !== 'accept' && action !== 'reject') {
      return Response.json({ error: 'Invalid action. Must be accept or reject' }, { status: 400 });
    }

    // Get agent profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const agentProfile = profiles[0];

    if (!agentProfile || agentProfile.user_role !== 'agent') {
      return Response.json({ error: 'Only agents can respond to requests' }, { status: 403 });
    }

    // Get room
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
    const room = rooms[0];

    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.agentId !== agentProfile.id) {
      return Response.json({ error: 'Not your request' }, { status: 403 });
    }

    if (room.request_status !== 'requested') {
      return Response.json({ error: 'Request already processed' }, { status: 409 });
    }

    // Update room status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    const timestamp = new Date().toISOString();
    
    const updateData = {
      request_status: newStatus
    };

    if (action === 'accept') {
      updateData.accepted_at = timestamp;
    } else {
      updateData.rejected_at = timestamp;
    }

    await base44.asServiceRole.entities.Room.update(room_id, updateData);

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      type: action === 'accept' ? 'agent_accepted' : 'agent_rejected',
      deal_id: room.deal_id,
      room_id,
      actor_id: agentProfile.id,
      actor_name: agentProfile.full_name || agentProfile.email,
      message: `${agentProfile.full_name || agentProfile.email} ${action === 'accept' ? 'accepted' : 'rejected'} the deal request`
    });

    return Response.json({ 
      success: true, 
      status: newStatus,
      message: action === 'accept' ? 'Request accepted! Chat is now enabled.' : 'Request rejected.'
    });

  } catch (error) {
    console.error('[respondToDealRequest] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});