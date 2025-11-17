import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const room_id = url.searchParams.get("room_id");
    const after = url.searchParams.get("after");

    if (!room_id) {
      return Response.json({ error: "room_id required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify room exists and user is participant
    const rooms = await base44.entities.Room.filter({ id: room_id });
    const room = rooms[0];
    
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];

    if (![room.investorId, room.agentId].includes(profile?.id)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get messages
    const filter = { room_id };
    if (after) {
      filter.created_date = { $gt: after };
    }

    const messages = await base44.entities.Message.filter(filter);

    return Response.json({ items: messages || [] });
  } catch (error) {
    console.error('[listMessages] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});