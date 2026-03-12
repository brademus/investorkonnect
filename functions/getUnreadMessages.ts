import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = (user.email || '').toLowerCase().trim();
    const profiles = await base44.asServiceRole.entities.Profile.filter({ email });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ messages: [], count: 0 });

    const profileId = profile.id;
    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor' || profile.role === 'admin';

    // For agents: use DealInvite index to find their rooms instead of scanning all rooms
    const [investorRooms, agentInvites] = await Promise.all([
      isInvestor ? base44.asServiceRole.entities.Room.filter({ investorId: profileId }).catch(() => []) : Promise.resolve([]),
      isAgent ? base44.asServiceRole.entities.DealInvite.filter({ agent_profile_id: profileId }).catch(() => []) : Promise.resolve([]),
    ]);

    const roomMap = new Map();
    (investorRooms || []).forEach(r => roomMap.set(r.id, r));

    // For agents: fetch only the specific rooms from their invites
    if (isAgent && agentInvites.length > 0) {
      const roomIds = [...new Set(agentInvites.map(inv => inv.room_id).filter(Boolean))];
      const agentRoomResults = await Promise.all(
        roomIds.slice(0, 10).map(rid => base44.asServiceRole.entities.Room.filter({ id: rid }).catch(() => []))
      );
      agentRoomResults.flat().forEach(r => roomMap.set(r.id, r));
    }

    const userRooms = [...roomMap.values()];
    if (userRooms.length === 0) return Response.json({ messages: [], count: 0 });

    const lastSeen = profile.last_seen_timestamps || {};

    const sortedRooms = [...userRooms]
      .sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))
      .slice(0, 10);

    const messageResults = await Promise.all(
      sortedRooms.map(r => base44.asServiceRole.entities.Message.filter({ room_id: r.id }, '-created_date', 5).catch(() => []))
    );

    const senderIds = new Set();
    const unreadRooms = [];

    for (let i = 0; i < sortedRooms.length; i++) {
      const room = sortedRooms[i];
      const messages = messageResults[i] || [];
      const lastSeenTs = lastSeen[room.id];

      const unread = messages.filter(m => {
        if (!m.body?.trim()) return false;
        if (m.sender_profile_id === profileId || m.sender_profile_id === 'system') return false;
        if (!lastSeenTs) return true;
        return new Date(m.created_date).getTime() > new Date(lastSeenTs).getTime();
      });

      if (unread.length > 0) {
        const latest = unread[0];
        if (latest.sender_profile_id) senderIds.add(latest.sender_profile_id);
        unreadRooms.push({ room, unread, latest });
      }
    }

    // Batch fetch sender profiles + deals
    const dealIds = [...new Set(unreadRooms.map(u => u.room.deal_id).filter(Boolean))];
    const senderIdArray = [...senderIds];

    const [senderProfiles, deals] = await Promise.all([
      senderIdArray.length > 0 ? base44.asServiceRole.entities.Profile.filter({ id: { $in: senderIdArray } }).catch(() => []) : Promise.resolve([]),
      dealIds.length > 0 ? base44.asServiceRole.entities.Deal.filter({ id: { $in: dealIds } }).catch(() => []) : Promise.resolve([]),
    ]);

    const senderMap = new Map((senderProfiles || []).map(p => [p.id, p]));
    const dealMap = new Map((deals || []).map(d => [d.id, d]));

    const result = unreadRooms.map(({ room, unread, latest }) => {
      const sender = senderMap.get(latest.sender_profile_id);
      const deal = dealMap.get(room.deal_id);
      const address = (deal?.property_address || '').split(',')[0] || room.title || '';

      return {
        roomId: room.id,
        dealId: room.deal_id,
        senderName: sender?.full_name || 'Unknown',
        senderHeadshot: sender?.headshotUrl || null,
        preview: latest.body?.substring(0, 80) || '',
        address,
        count: unread.length,
        timestamp: latest.created_date,
      };
    });

    return Response.json({
      messages: result,
      count: result.reduce((sum, r) => sum + r.count, 0),
    });
  } catch (error) {
    console.error('[getUnreadMessages] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});