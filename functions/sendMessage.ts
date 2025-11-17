import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function audit(base44, actor_profile_id, action, entity_type, entity_id, meta = {}) {
  try {
    await base44.entities.AuditLog.create({
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      meta,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Audit failed:", e);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { room_id, body: text } = body || {};

    if (!room_id || !text) {
      return Response.json({ error: "room_id and body required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get room and verify access
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

    // Create message
    const message = await base44.entities.Message.create({
      room_id,
      sender_profile_id: profile.id,
      body: text
    });

    await audit(base44, profile.id, "message.send", "Message", message.id, { room_id });

    return Response.json({ ok: true, message });
  } catch (error) {
    console.error('[sendMessage] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});