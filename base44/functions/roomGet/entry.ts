import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const roomId = url.searchParams.get('roomId');

    if (!roomId) {
      return Response.json({ error: 'roomId required' }, { status: 400 });
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

    // Get messages (last 50)
    const messages = await base44.entities.RoomMessage.filter({ roomId }, '-created_date', 50);

    // Get investor and agent profiles
    const allProfiles = await base44.entities.Profile.filter({});
    const profilesMap = {};
    allProfiles.forEach(p => profilesMap[p.id] = p);

    const investor = profilesMap[room.investorId];
    const agent = profilesMap[room.agentId];

    return Response.json({
      room: {
        id: room.id,
        ndaAcceptedInvestor: room.ndaAcceptedInvestor,
        ndaAcceptedAgent: room.ndaAcceptedAgent,
        investor: {
          userId: investor?.id,
          name: investor?.full_name,
          company: investor?.company
        },
        agent: {
          userId: agent?.id,
          name: agent?.full_name,
          company: agent?.company,
          vetted: agent?.vetted
        },
        currentUserRole: room.investorId === profile.id ? 'investor' : 'agent'
      },
      messages: messages.reverse().map(m => ({
        id: m.id,
        senderUserId: m.senderUserId,
        senderName: m.senderUserId === 'system' ? 'System' : profilesMap[m.senderUserId]?.full_name,
        kind: m.kind,
        text: m.text,
        fileUrl: m.fileUrl,
        createdAt: m.created_date
      }))
    });

  } catch (error) {
    console.error('Room get error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});