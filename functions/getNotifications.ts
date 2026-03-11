import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const email = (user.email || '').toLowerCase().trim();
    const profiles = await base44.entities.Profile.filter({ email });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ notifications: [] });

    const profileId = profile.id;
    const isAdmin = profile.role === 'admin' || profile.user_role === 'admin';
    const isAgent = !isAdmin && profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor' || isAdmin;

    const [investorRooms, agentRooms] = await Promise.all([
      isInvestor ? base44.entities.Room.filter({ investorId: profileId }).catch(() => []) : Promise.resolve([]),
      isAgent ? base44.entities.Room.filter({}).catch(() => []) : Promise.resolve([]),
    ]);

    const roomMap = new Map();
    (investorRooms || []).forEach(r => roomMap.set(r.id, r));
    (agentRooms || []).forEach(r => {
      if ((r.agent_ids || []).includes(profileId)) roomMap.set(r.id, r);
    });

    const userRooms = [...roomMap.values()];
    const userRoomIds = new Set(userRooms.map(r => r.id));
    const userDealIds = new Set(userRooms.map(r => r.deal_id).filter(Boolean));

    if (userRooms.length === 0 && !isInvestor) {
      return Response.json({ notifications: [] });
    }

    const dealIdArray = [...userDealIds];
    const roomIdArray = [...userRoomIds];

    const [deals, counterOffers, dealInvites, appointments] = await Promise.all([
      dealIdArray.length > 0
        ? base44.entities.Deal.filter({ id: { $in: dealIdArray } }).catch(() => [])
        : isInvestor ? base44.entities.Deal.filter({ investor_id: profileId }).catch(() => []) : Promise.resolve([]),
      roomIdArray.length > 0
        ? base44.entities.CounterOffer.filter({ room_id: { $in: roomIdArray }, status: 'pending' }).catch(() => [])
        : Promise.resolve([]),
      isAgent ? base44.entities.DealInvite.filter({ agent_profile_id: profileId }).catch(() => []) : Promise.resolve([]),
      dealIdArray.length > 0
        ? base44.entities.DealAppointments.filter({ dealId: { $in: dealIdArray } }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const dealMap = new Map();
    (deals || []).forEach(d => dealMap.set(d.id, d));

    const apptMap = new Map();
    (appointments || []).forEach(a => { if (a.dealId) apptMap.set(a.dealId, a); });

    const lastSeen = profile.last_seen_timestamps || {};
    const notifications = [];

    // ─── 1. UNREAD MESSAGES ───
    const sortedRooms = [...userRooms]
      .sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))
      .slice(0, 5);

    const messageResults = await Promise.all(
      sortedRooms.map(r => base44.entities.Message.filter({ room_id: r.id }, '-created_date', 5).catch(() => []))
    );

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
        const deal = dealMap.get(room.deal_id);
        const address = deal?.property_address || room?.property_address || 'a deal';
        const shortAddress = address.split(',')[0];
        notifications.push({
          type: 'unread_messages',
          title: unread.length === 1 ? 'New message' : `${unread.length} new messages`,
          description: shortAddress,
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: unread[0].created_date,
          priority: 'medium',
        });
      }
    }

    // ─── 2. COUNTER OFFER PENDING ───
    for (const co of (counterOffers || [])) {
      const isForMe = (isInvestor && co.to_role === 'investor') ||
                      (isAgent && co.to_role === 'agent') ||
                      co.to_profile_id === profileId;
      if (isForMe) {
        const deal = dealMap.get(co.deal_id);
        const address = (deal?.property_address || '').split(',')[0] || 'a deal';
        notifications.push({
          type: 'counter_offer_pending',
          title: 'Counter offer received',
          description: `Review terms — ${address}`,
          roomId: co.room_id,
          dealId: co.deal_id,
          timestamp: co.created_date,
          priority: 'high',
        });
      }
    }

    // ─── 3. AGENT: NEW DEAL INVITES ───
    if (isAgent) {
      for (const inv of (dealInvites || [])) {
        if (inv.status === 'PENDING_AGENT_SIGNATURE' || inv.status === 'INVITED') {
          const deal = dealMap.get(inv.deal_id);
          const address = (deal?.property_address || deal?.city || 'a deal').split(',')[0];
          notifications.push({
            type: 'new_deal',
            title: 'New deal invitation',
            description: `Sign to accept — ${address}`,
            roomId: inv.room_id,
            dealId: inv.deal_id,
            timestamp: inv.created_date || inv.created_at_iso,
            priority: 'high',
          });
        }
      }
    }

    // ─── 4. PER-ROOM ACTION ITEMS ───
    for (const room of userRooms) {
      const deal = dealMap.get(room.deal_id);
      if (!deal) continue;

      const address = (deal.property_address || '').split(',')[0] || 'a deal';
      const stage = deal.pipeline_stage || 'new_deals';
      const isSigned = room.agreement_status === 'fully_signed' || room.request_status === 'locked';
      const appt = apptMap.get(room.deal_id);
      const wtStatus = appt?.walkthrough?.status || 'NOT_SET';
      const docs = deal.documents || {};

      if (room.requires_regenerate) {
        notifications.push({
          type: 'agreement_regenerated',
          title: 'Agreement updated — re-sign required',
          description: address,
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: room.updated_date,
          priority: 'high',
        });
      }

      const wt = appt?.walkthrough;
      if (wt?.status === 'PROPOSED' && wt?.updatedByUserId && wt.updatedByUserId !== profileId) {
        notifications.push({
          type: 'walkthrough_confirm',
          title: 'Walkthrough date proposed',
          description: `Confirm or suggest another time — ${address}`,
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: wt.updatedAt || appt.updated_date,
          priority: 'high',
        });
      }

      if (!isSigned) continue;

      if (isInvestor && stage === 'connected_deals' && (wtStatus === 'NOT_SET' || wtStatus === 'CANCELED')) {
        notifications.push({
          type: 'action_needed',
          title: 'Schedule walkthrough',
          description: address,
          roomId: room.id,
          dealId: deal.id,
          timestamp: deal.updated_date,
          priority: 'medium',
        });
      }

      if (isAgent && stage === 'connected_deals' && !docs.cma?.url && (wtStatus === 'SCHEDULED' || wtStatus === 'COMPLETED')) {
        notifications.push({
          type: 'action_needed',
          title: 'Upload CMA',
          description: address,
          roomId: room.id,
          dealId: deal.id,
          timestamp: deal.updated_date,
          priority: 'medium',
        });
      }

      if (isInvestor && stage === 'connected_deals' && docs.cma?.url && !deal.list_price_confirmed) {
        notifications.push({
          type: 'action_needed',
          title: 'Review estimated list price',
          description: address,
          roomId: room.id,
          dealId: deal.id,
          timestamp: deal.updated_date,
          priority: 'medium',
        });
      }

      if (isAgent && stage === 'active_listings' && !docs.buyer_contract?.url) {
        notifications.push({
          type: 'action_needed',
          title: "Upload buyer's contract",
          description: address,
          roomId: room.id,
          dealId: deal.id,
          timestamp: deal.updated_date,
          priority: 'medium',
        });
      }

      if (isInvestor && stage === 'in_closing') {
        notifications.push({
          type: 'action_needed',
          title: 'Confirm deal closed',
          description: address,
          roomId: room.id,
          dealId: deal.id,
          timestamp: deal.updated_date,
          priority: 'medium',
        });
      }
    }

    // ─── DEDUPLICATE & SORT ───
    const seen = new Set();
    const deduped = notifications.filter(n => {
      const key = `${n.type}:${n.dealId || ''}:${n.roomId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    deduped.sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    return Response.json({ notifications: deduped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});