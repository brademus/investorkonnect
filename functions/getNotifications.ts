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

    // Fetch rooms, deals, messages, counter offers, invites, agreements in parallel
    const [investorRooms, allRooms, allDeals, counterOffers, dealInvites, agreements, appointments] = await Promise.all([
      base44.entities.Room.filter({ investorId: profileId }).catch(() => []),
      base44.entities.Room.filter({}).catch(() => []),
      base44.entities.Deal.filter({}).catch(() => []),
      base44.entities.CounterOffer.filter({ status: 'pending' }).catch(() => []),
      isAgent ? base44.entities.DealInvite.filter({ agent_profile_id: profileId }).catch(() => []) : Promise.resolve([]),
      base44.entities.LegalAgreement.filter({}).catch(() => []),
      base44.entities.DealAppointments.filter({}).catch(() => []),
    ]);

    // Build room map for this user
    const roomMap = new Map();
    (investorRooms || []).forEach(r => roomMap.set(r.id, r));
    (allRooms || []).forEach(r => {
      if ((r.agent_ids || []).includes(profileId)) roomMap.set(r.id, r);
    });
    const userRooms = [...roomMap.values()];
    const userRoomIds = new Set(userRooms.map(r => r.id));
    const userDealIds = new Set(userRooms.map(r => r.deal_id).filter(Boolean));

    // Build deal map
    const dealMap = new Map();
    (allDeals || []).forEach(d => {
      if (d.investor_id === profileId || userDealIds.has(d.id)) {
        dealMap.set(d.id, d);
      }
    });

    // Appointment map
    const apptMap = new Map();
    (appointments || []).forEach(a => { if (a.dealId) apptMap.set(a.dealId, a); });

    const notifications = [];
    const lastSeen = profile.last_seen_timestamps || {};

    // 1. Unread messages
    const roomIds = userRooms.map(r => r.id);
    const messagePromises = roomIds.map(rid =>
      base44.entities.Message.filter({ room_id: rid }, '-created_date', 3).catch(() => [])
    );
    const messageResults = await Promise.all(messagePromises);

    for (let i = 0; i < roomIds.length; i++) {
      const rid = roomIds[i];
      const room = roomMap.get(rid);
      const messages = messageResults[i] || [];
      if (messages.length === 0) continue;

      const lastSeenTs = lastSeen[rid];
      const unread = messages.filter(m => {
        if (m.sender_profile_id === profileId) return false;
        if (!lastSeenTs) return true;
        return new Date(m.created_date).getTime() > new Date(lastSeenTs).getTime();
      });

      if (unread.length > 0) {
        const deal = dealMap.get(room?.deal_id);
        const addr = deal?.property_address || room?.property_address || 'a deal';
        notifications.push({
          type: 'unread_messages',
          title: `${unread.length} new message${unread.length > 1 ? 's' : ''}`,
          description: addr,
          roomId: rid,
          dealId: room?.deal_id,
          timestamp: unread[0].created_date,
          priority: 'medium',
        });
      }
    }

    // 2. Pending counter offers directed at this user
    for (const co of (counterOffers || [])) {
      if (!userDealIds.has(co.deal_id) && !userRoomIds.has(co.room_id)) continue;
      const isForMe = (isInvestor && co.to_role === 'investor') || (isAgent && co.to_role === 'agent') || co.to_profile_id === profileId;
      if (!isForMe) continue;
      const deal = dealMap.get(co.deal_id);
      notifications.push({
        type: 'counter_offer',
        title: 'Counter offer pending',
        description: `Review and respond to a counter offer on ${deal?.property_address || 'a deal'}`,
        roomId: co.room_id,
        dealId: co.deal_id,
        timestamp: co.created_date,
        priority: 'high',
      });
    }

    // 3. Agent: new deal invites awaiting signature
    if (isAgent) {
      for (const inv of (dealInvites || [])) {
        if (inv.status === 'PENDING_AGENT_SIGNATURE' || inv.status === 'INVITED') {
          const deal = dealMap.get(inv.deal_id) || (allDeals || []).find(d => d.id === inv.deal_id);
          notifications.push({
            type: 'agreement_sign',
            title: 'New deal — signature required',
            description: `Sign the agreement for ${deal?.property_address || deal?.city || 'a new deal'}`,
            roomId: inv.room_id,
            dealId: inv.deal_id,
            timestamp: inv.created_date || inv.created_at_iso,
            priority: 'high',
          });
        }
      }
    }

    // 4. Agreements that need signing (regenerated or pending)
    for (const agr of (agreements || [])) {
      if (!userDealIds.has(agr.deal_id) && !userRoomIds.has(agr.room_id)) continue;
      if (agr.status === 'voided' || agr.status === 'superseded' || agr.status === 'fully_signed') continue;

      const deal = dealMap.get(agr.deal_id);
      const addr = deal?.property_address || 'a deal';

      // Investor needs to sign
      if (isInvestor && agr.investor_user_id === user.id && agr.status === 'sent') {
        notifications.push({
          type: 'agreement_sign',
          title: 'Agreement awaiting your signature',
          description: addr,
          roomId: agr.room_id,
          dealId: agr.deal_id,
          timestamp: agr.updated_date || agr.created_date,
          priority: 'high',
        });
      }

      // Agent needs to sign
      if (isAgent && agr.agent_user_id === user.id && agr.status === 'investor_signed') {
        notifications.push({
          type: 'agreement_sign',
          title: 'Agreement awaiting your signature',
          description: addr,
          roomId: agr.room_id,
          dealId: agr.deal_id,
          timestamp: agr.updated_date || agr.created_date,
          priority: 'high',
        });
      }
    }

    // 5. Rooms with requires_regenerate flag
    for (const room of userRooms) {
      if (room.requires_regenerate) {
        const deal = dealMap.get(room.deal_id);
        notifications.push({
          type: 'agreement_regenerated',
          title: 'Agreement regenerated — re-sign needed',
          description: deal?.property_address || 'a deal',
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: room.updated_date,
          priority: 'high',
        });
      }
    }

    // 6. Walkthrough proposed — awaiting confirmation from this user
    for (const room of userRooms) {
      const deal = dealMap.get(room.deal_id);
      const appt = apptMap.get(room.deal_id);
      if (!appt || !appt.walkthrough) continue;
      const wt = appt.walkthrough;
      if (wt.status !== 'PROPOSED') continue;
      // If proposed by someone else, this user needs to confirm
      if (wt.updatedByUserId && wt.updatedByUserId !== profileId) {
        notifications.push({
          type: 'walkthrough_confirm',
          title: 'Confirm walkthrough date',
          description: deal?.property_address || 'a deal',
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: wt.updatedAt || appt.updated_date,
          priority: 'medium',
        });
      }
    }

    // 7. Deal progress actions needed (document uploads, list price review, etc.)
    for (const room of userRooms) {
      const deal = dealMap.get(room.deal_id);
      if (!deal) continue;
      const stage = deal.pipeline_stage || 'new_deals';
      const isSigned = room.agreement_status === 'fully_signed' || room.request_status === 'locked';
      const appt = apptMap.get(deal.id);
      const wtStatus = appt?.walkthrough?.status || 'NOT_SET';
      const docs = deal.documents || {};

      if (stage === 'connected_deals' && isSigned) {
        // CMA needed (agent action)
        if (isAgent && !docs.cma?.url && (wtStatus === 'SCHEDULED' || wtStatus === 'COMPLETED')) {
          notifications.push({
            type: 'action_needed',
            title: 'Upload CMA',
            description: deal.property_address || 'a deal',
            roomId: room.id,
            dealId: deal.id,
            timestamp: deal.updated_date,
            priority: 'low',
          });
        }
        // List price review (investor action)
        if (isInvestor && docs.cma?.url && !deal.list_price_confirmed) {
          notifications.push({
            type: 'action_needed',
            title: 'Review estimated list price',
            description: deal.property_address || 'a deal',
            roomId: room.id,
            dealId: deal.id,
            timestamp: deal.updated_date,
            priority: 'medium',
          });
        }
        // Listing agreement needed (agent action)
        if (isAgent && docs.cma?.url && deal.list_price_confirmed && !docs.listing_agreement?.url) {
          notifications.push({
            type: 'action_needed',
            title: 'Upload listing agreement',
            description: deal.property_address || 'a deal',
            roomId: room.id,
            dealId: deal.id,
            timestamp: deal.updated_date,
            priority: 'low',
          });
        }
      }

      if (stage === 'active_listings' && isSigned) {
        // Buyer contract needed (agent action)
        if (isAgent && !docs.buyer_contract?.url) {
          notifications.push({
            type: 'action_needed',
            title: "Upload buyer's contract",
            description: deal.property_address || 'a deal',
            roomId: room.id,
            dealId: deal.id,
            timestamp: deal.updated_date,
            priority: 'low',
          });
        }
        // Move to closing (investor action)
        if (isInvestor && docs.buyer_contract?.url) {
          notifications.push({
            type: 'action_needed',
            title: 'Move deal to closing',
            description: deal.property_address || 'a deal',
            roomId: room.id,
            dealId: deal.id,
            timestamp: deal.updated_date,
            priority: 'medium',
          });
        }
      }

      if (stage === 'in_closing' && isInvestor) {
        notifications.push({
          type: 'action_needed',
          title: 'Confirm deal closed?',
          description: deal.property_address || 'a deal',
          roomId: room.id,
          dealId: deal.id,
          timestamp: deal.updated_date,
          priority: 'medium',
        });
      }
    }

    // Deduplicate by type+dealId
    const seen = new Set();
    const deduped = notifications.filter(n => {
      const key = `${n.type}:${n.dealId || ''}:${n.roomId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort: high priority first, then by timestamp desc
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