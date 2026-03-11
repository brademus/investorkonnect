import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId, body } = await req.json();
    if (!roomId || !body) return Response.json({ error: 'roomId and body required' }, { status: 400 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const roomArr = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    const room = roomArr?.[0];
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    const isParticipant = room.investorId === profile.id || (room.agent_ids || []).includes(profile.id);
    if (!isParticipant) return Response.json({ error: 'Forbidden' }, { status: 403 });

    await base44.asServiceRole.entities.Message.create({
      room_id: roomId,
      sender_profile_id: 'system',
      body: body.trim()
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});