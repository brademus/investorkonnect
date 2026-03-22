import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get profile
    const email = (user.email || '').toLowerCase().trim();
    const profiles = await base44.entities.Profile.filter({ email });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ count: 0, roomIds: [] });

    const profileId = profile.id;

    // Get all rooms where user is investor or agent
    const [investorRooms, allRooms] = await Promise.all([
      base44.entities.Room.filter({ investorId: profileId }).catch(() => []),
      // For agents, we need to check agent_ids which requires fetching broader
      base44.entities.Room.filter({}).catch(() => []),
    ]);

    // Combine: investor rooms + rooms where profileId is in agent_ids
    const roomMap = new Map();
    (investorRooms || []).forEach(r => roomMap.set(r.id, r));
    (allRooms || []).forEach(r => {
      if ((r.agent_ids || []).includes(profileId)) roomMap.set(r.id, r);
    });

    const userRooms = [...roomMap.values()];
    if (userRooms.length === 0) return Response.json({ count: 0, roomIds: [] });

    // Get last_seen_timestamps from profile
    const lastSeen = profile.last_seen_timestamps || {};

    // For each room, get the latest message and compare
    const roomIds = userRooms.map(r => r.id);
    
    // Fetch messages for all rooms in parallel (batch by room_id)
    const messagePromises = roomIds.map(rid =>
      base44.entities.Message.filter({ room_id: rid }, '-created_date', 1).catch(() => [])
    );
    const messageResults = await Promise.all(messagePromises);

    const unreadRoomIds = [];
    for (let i = 0; i < roomIds.length; i++) {
      const rid = roomIds[i];
      const messages = messageResults[i] || [];
      if (messages.length === 0) continue;

      const latestMsg = messages[0];
      // Skip messages sent by this user
      if (latestMsg.sender_profile_id === profileId) continue;

      const lastSeenTs = lastSeen[rid];
      if (!lastSeenTs) {
        // Never seen this room — it's unread
        unreadRoomIds.push(rid);
      } else {
        const msgTime = new Date(latestMsg.created_date).getTime();
        const seenTime = new Date(lastSeenTs).getTime();
        if (msgTime > seenTime) {
          unreadRoomIds.push(rid);
        }
      }
    }

    return Response.json({ count: unreadRoomIds.length, roomIds: unreadRoomIds });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});