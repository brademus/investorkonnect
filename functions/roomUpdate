import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { roomId, ndaAccept } = body;

    if (!roomId || typeof ndaAccept !== 'boolean') {
      return Response.json({ error: 'roomId and ndaAccept required' }, { status: 400 });
    }

    // Get user profile
    const profiles = await base44.entities.Profile.filter({ email: user.email });
    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    const profile = profiles[0];

    // Get room
    const rooms = await base44.entities.Room.filter({ id: roomId });
    if (rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];

    // Check access
    if (room.investorId !== profile.id && room.agentId !== profile.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update NDA status
    const update = {};
    if (room.investorId === profile.id) {
      update.ndaAcceptedInvestor = ndaAccept;
    } else {
      update.ndaAcceptedAgent = ndaAccept;
    }

    await base44.entities.Room.update(roomId, update);

    // Create system message if accepted
    if (ndaAccept) {
      const userName = profile.full_name || 'User';
      await base44.entities.RoomMessage.create({
        roomId: roomId,
        senderUserId: 'system',
        kind: 'system',
        text: `${userName} accepted the NDA`
      });
    }

    return Response.json({ ok: true });

  } catch (error) {
    console.error('Room update error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});