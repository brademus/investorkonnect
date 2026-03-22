import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { roomId, kind, text, fileUrl } = body;

    if (!roomId || !kind) {
      return Response.json({ error: 'roomId and kind required' }, { status: 400 });
    }

    if (kind !== 'text' && kind !== 'file') {
      return Response.json({ error: 'kind must be text or file' }, { status: 400 });
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

    // Check NDA requirement for files
    if (kind === 'file' && (!room.ndaAcceptedInvestor || !room.ndaAcceptedAgent)) {
      return Response.json({ 
        error: 'Both parties must accept NDA before sharing files' 
      }, { status: 400 });
    }

    // Create message
    const message = await base44.entities.RoomMessage.create({
      roomId: roomId,
      senderUserId: profile.id,
      kind: kind,
      text: text || '',
      fileUrl: fileUrl || ''
    });

    return Response.json({ 
      ok: true, 
      messageId: message.id 
    });

  } catch (error) {
    console.error('Message post error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});