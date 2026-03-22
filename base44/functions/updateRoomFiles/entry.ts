import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { roomId, files } = await req.json();
    if (!roomId || !Array.isArray(files)) {
      return Response.json({ error: 'roomId and files array required' }, { status: 400 });
    }

    const email = (user.email || '').toLowerCase().trim();
    const profiles = await base44.entities.Profile.filter({ email });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    const room = rooms?.[0];
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    const isInvestor = room.investorId === profile.id;
    const isAgent = (room.agent_ids || []).includes(profile.id);
    if (!isInvestor && !isAgent) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Room.update(roomId, { files });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});