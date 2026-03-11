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

    // Only fetch rooms for THIS user (not all rooms)
    const [investorRooms, agentRooms] = await Promise.all([
      isInvestor ? base44.entities.Room.filter({ investorId: profileId }).catch(() => []) : Promise.resolve([]),
      isAgent ? base44.entities.Room.filter({}).catch(() => []) : Promise.resolve([]),
    ]);

    // Build user's rooms
    const roomMap = new Map();
    (investorRooms || []).forEach(r => roomMap.set(r.id, r));
    // For agents, filter to only rooms they're in
    (agentRooms || []).forEach(r => {
      if ((r.agent_ids || []).includes(profileId)) roomMap.set(r.id, r);
    });
    const userRooms = [...roomMap.values()];
    const userRoomIds = new Set(userRooms.map(r => r.id));
    const userDealIds = new Set(userRooms.map(r => r.deal_id).filter(Boolean));

    if (userRooms.length === 0 && !isInvestor) {
      return Response.json({ notifications: [] });
    }

    // Fetch only relevant data in parallel — scoped to user's deals/rooms
    const dealIdArray = [...userDealIds];
    const roomIdArray = [...userRoomIds];

    const [deals, counterOffers, dealInvites, appointments] = await Promise.all([
      // Fetch deals for this user's rooms
      dealIdArray.length > 0
        ? base44.entities.Deal.filter({ id: { $in: dealIdArray } }).catch(() => [])
        : isInvestor ? base44.entities.Deal.filter({ investor_id: profileId }).catch(() => []) : Promise.resolve([]),
      // Counter offers only for user's rooms
      roomIdArray.length > 0
        ? base44.entities.CounterOffer.filter({ room_id: { $in: roomIdArray }, status: 'pending' }).catch(() => [])
        : Promise.resolve([]),
      // Agent invites
      isAgent ? base44.entities.DealInvite.filter({ agent_profile_id: profileId }).catch(() => []) : Promise.resolve([]),
      // Appointments for user's deals
      dealIdArray.length > 0
        ? base44.entities.DealAppointments.filter({ dealId: { $in: dealIdArray } }).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Add investor deals to the set
    (deals || []).forEach(d => {
      if (d.investor_id === profileId) userDealIds.add(d.id);
    });

    // Build lookup maps
    const dealMap = new Map();
    (deals || []).forEach(d => dealMap.set(d.id, d));

    const apptMap = new Map();
    (appointments || []).forEach(a => { if (a.dealId) apptMap.set(a.dealId, a); });

    const roomByDeal = new Map();
    userRooms.forEach(r => { if (r.deal_id) roomByDeal.set(r.deal_id, r); });

    const notifications = [];
    const lastSeen = profile.last_seen_timestamps || {};

    // ─── 1. UNREAD MESSAGES (only check rooms with recent activity) ───
    // Only check the 5 most recently updated rooms to limit API calls
    const sortedRooms = [...userRooms].sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0)).slice(0, 5);
    const messagePromises = sortedRooms.map(r =>
      base44.entities.Message.filter({ room_id: r.id }, '-created_date', 3).catch(() => [])
    );
    const messageResults = await Promise.all(messagePromises);

    for (let i = 0; i < sortedRooms.length; i++) {
      const room = sortedRooms[i];
      const messages = messageResults[i] || [];
      if (messages.length === 0) continue;

      const lastSeenTs = lastSeen[room.id];
      const unread = messages.filter(m => {
        if (m.sender_profile_id === profileId) return false;
        if (!lastSeenTs) return true;
        return new Date(m.created_date).getTime() > new Date(lastSeenTs).getTime();
      });

      if (unread.length > 0) {
        const deal = dealMap.get(room.deal_id);
        notifications.push({
          type: 'unread_messages',
          title: `${unread.length} new message${unread.length > 1 ? 's' : ''}`,
          description: deal?.property_address || room?.property_address || 'a deal',
          roomId: room.id, dealId: room.deal_id,
          timestamp: unread[0].created_date,
          priority: 'medium',
        });
      }
    }

    // ─── 2. PENDING COUNTER OFFERS ───
    for (const co of (counterOffers || [])) {
      const isForMe = (isInvestor && co.to_role === 'investor') || (isAgent && co.to_role === 'agent') || co.to_profile_id === profileId;
      if (isForMe) {
        const deal = dealMap.get(co.deal_id);
        notifications.push({
          type: 'counter_offer_pending',
          title: 'Counter offer requires your response',
          description: deal?.property_address || 'a deal',
          roomId: co.room_id, dealId: co.deal_id,
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
          notifications.push({
            type: 'new_deal',
            title: 'New deal — signature required',
            description: `Sign the agreement for ${deal?.property_address || deal?.city || 'a new deal'}`,
            roomId: inv.room_id, dealId: inv.deal_id,
            timestamp: inv.created_date || inv.created_at_iso,
            priority: 'high',
          });
        }
      }
    }

    // ─── 4. ROOMS NEEDING ACTION ───
    for (const room of userRooms) {
      const deal = dealMap.get(room.deal_id);
      if (!deal) continue;

      // Requires regeneration
      if (room.requires_regenerate) {
        notifications.push({
          type: 'agreement_regenerated',
          title: 'Agreement regenerated — re-sign needed',
          description: deal.property_address || 'a deal',
          roomId: room.id, dealId: room.deal_id,
          timestamp: room.updated_date,
          priority: 'high',
        });
      }

      // Walkthrough events
      const appt = apptMap.get(room.deal_id);
      if (appt?.walkthrough) {
        const wt = appt.walkthrough;
        if (wt.status === 'PROPOSED' && wt.updatedByUserId && wt.updatedByUserId !== profileId) {
          notifications.push({
            type: 'walkthrough_confirm',
            title: 'Walkthrough proposed — confirm dates',
            description: deal.property_address || 'a deal',
            roomId: room.id, dealId: room.deal_id,
            timestamp: wt.updatedAt || appt.updated_date,
            priority: 'high',
          });
        }
      }

      // Deal progress actions
      const stage = deal.pipeline_stage || 'new_deals';
      const isSigned = room.agreement_status === 'fully_signed' || room.request_status === 'locked';
      const wtStatus = appt?.walkthrough?.status || 'NOT_SET';
      const docs = deal.documents || {};

      if (stage === 'connected_deals' && isSigned && isInvestor && (wtStatus === 'NOT_SET' || wtStatus === 'CANCELED')) {
        notifications.push({
          type: 'action_needed', title: 'Schedule walkthrough',
          description: deal.property_address || 'a deal',
          roomId: room.id, dealId: deal.id,
          timestamp: deal.updated_date, priority: 'medium',
        });
      }

      if (stage === 'connected_deals' && isSigned) {
        if (isAgent && !docs.cma?.url && (wtStatus === 'SCHEDULED' || wtStatus === 'COMPLETED')) {
          notifications.push({ type: 'action_needed', title: 'Upload CMA', description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
        if (isInvestor && docs.cma?.url && !deal.list_price_confirmed) {
          notifications.push({ type: 'action_needed', title: 'Review estimated list price', description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
      }

      if (stage === 'active_listings' && isSigned) {
        if (isAgent && !docs.buyer_contract?.url) {
          notifications.push({ type: 'action_needed', title: "Upload buyer's contract", description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
      }

      if (stage === 'in_closing' && isInvestor) {
        notifications.push({ type: 'action_needed', title: 'Confirm deal closed?', description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
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