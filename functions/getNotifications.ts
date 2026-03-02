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

    // Fetch all data in parallel
    const [investorRooms, allRooms, allDeals, counterOffers, dealInvites, agreements, appointments, activities] = await Promise.all([
      base44.entities.Room.filter({ investorId: profileId }).catch(() => []),
      base44.entities.Room.filter({}).catch(() => []),
      base44.entities.Deal.filter({}).catch(() => []),
      base44.entities.CounterOffer.filter({}).catch(() => []),
      isAgent ? base44.entities.DealInvite.filter({ agent_profile_id: profileId }).catch(() => []) : Promise.resolve([]),
      base44.entities.LegalAgreement.filter({}).catch(() => []),
      base44.entities.DealAppointments.filter({}).catch(() => []),
      base44.entities.Activity.filter({}, '-created_date', 50).catch(() => []),
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

    // Also include deals where this user is investor_id (for new deals before room exists)
    (allDeals || []).forEach(d => {
      if (d.investor_id === profileId) userDealIds.add(d.id);
    });

    // Build deal map
    const dealMap = new Map();
    (allDeals || []).forEach(d => {
      if (userDealIds.has(d.id)) dealMap.set(d.id, d);
    });

    // Room by deal_id lookup
    const roomByDeal = new Map();
    userRooms.forEach(r => { if (r.deal_id) roomByDeal.set(r.deal_id, r); });

    // Appointment map
    const apptMap = new Map();
    (appointments || []).forEach(a => { if (a.dealId) apptMap.set(a.dealId, a); });

    const notifications = [];
    const lastSeen = profile.last_seen_timestamps || {};

    // ─── 1. UNREAD MESSAGES ───
    const roomIds = userRooms.map(r => r.id);
    const messagePromises = roomIds.map(rid =>
      base44.entities.Message.filter({ room_id: rid }, '-created_date', 5).catch(() => [])
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

    // ─── 2. PENDING COUNTER OFFERS (need response) ───
    for (const co of (counterOffers || [])) {
      if (!userDealIds.has(co.deal_id) && !userRoomIds.has(co.room_id)) continue;
      
      if (co.status === 'pending') {
        const isForMe = (isInvestor && co.to_role === 'investor') || (isAgent && co.to_role === 'agent') || co.to_profile_id === profileId;
        if (isForMe) {
          const deal = dealMap.get(co.deal_id);
          notifications.push({
            type: 'counter_offer_pending',
            title: 'Counter offer requires your response',
            description: deal?.property_address || 'a deal',
            roomId: co.room_id,
            dealId: co.deal_id,
            timestamp: co.created_date,
            priority: 'high',
          });
        }
      }

      // Counter accepted — notify the person who SENT it
      if (co.status === 'accepted') {
        const iSentIt = co.from_profile_id === profileId || (isInvestor && co.from_role === 'investor') || (isAgent && co.from_role === 'agent');
        if (iSentIt) {
          const deal = dealMap.get(co.deal_id);
          notifications.push({
            type: 'counter_offer_accepted',
            title: 'Your counter offer was accepted',
            description: deal?.property_address || 'a deal',
            roomId: co.room_id,
            dealId: co.deal_id,
            timestamp: co.responded_at || co.updated_date,
            priority: 'high',
          });
        }
      }

      // Counter declined — notify the person who sent it
      if (co.status === 'declined') {
        const iSentIt = co.from_profile_id === profileId || (isInvestor && co.from_role === 'investor') || (isAgent && co.from_role === 'agent');
        if (iSentIt) {
          const deal = dealMap.get(co.deal_id);
          notifications.push({
            type: 'counter_offer_declined',
            title: 'Your counter offer was declined',
            description: deal?.property_address || 'a deal',
            roomId: co.room_id,
            dealId: co.deal_id,
            timestamp: co.responded_at || co.updated_date,
            priority: 'medium',
          });
        }
      }
    }

    // ─── 3. AGENT: NEW DEAL INVITES ───
    if (isAgent) {
      for (const inv of (dealInvites || [])) {
        if (inv.status === 'PENDING_AGENT_SIGNATURE' || inv.status === 'INVITED') {
          const deal = dealMap.get(inv.deal_id) || (allDeals || []).find(d => d.id === inv.deal_id);
          notifications.push({
            type: 'new_deal',
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

    // ─── 4. AGREEMENTS NEEDING SIGNATURE ───
    for (const agr of (agreements || [])) {
      if (!userDealIds.has(agr.deal_id) && !userRoomIds.has(agr.room_id)) continue;
      const deal = dealMap.get(agr.deal_id);
      const addr = deal?.property_address || 'a deal';

      // Skip terminal statuses
      if (agr.status === 'voided' || agr.status === 'superseded') continue;

      // Fully signed — notify both parties
      if (agr.status === 'fully_signed') {
        // Only show if signed recently (within 7 days)
        const signedAt = agr.agent_signed_at || agr.investor_signed_at || agr.updated_date;
        if (signedAt && (Date.now() - new Date(signedAt).getTime()) < 7 * 86400000) {
          notifications.push({
            type: 'agreement_fully_signed',
            title: 'Agreement fully signed ✓',
            description: addr,
            roomId: agr.room_id,
            dealId: agr.deal_id,
            timestamp: signedAt,
            priority: 'medium',
          });
        }
        continue;
      }

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

      // Investor signed — notify agent
      if (isAgent && agr.agent_user_id === user.id && agr.investor_signed_at && agr.status === 'investor_signed') {
        notifications.push({
          type: 'investor_signed',
          title: 'Investor signed the agreement',
          description: `${addr} — now awaiting your signature`,
          roomId: agr.room_id,
          dealId: agr.deal_id,
          timestamp: agr.investor_signed_at,
          priority: 'high',
        });
      }

      // Agent signed — notify investor
      if (isInvestor && agr.investor_user_id === user.id && agr.agent_signed_at && agr.status === 'agent_signed') {
        notifications.push({
          type: 'agent_signed',
          title: 'Agent signed the agreement',
          description: addr,
          roomId: agr.room_id,
          dealId: agr.deal_id,
          timestamp: agr.agent_signed_at,
          priority: 'high',
        });
      }
    }

    // ─── 5. ROOMS WITH REQUIRES_REGENERATE ───
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

    // ─── 6. WALKTHROUGH EVENTS ───
    for (const room of userRooms) {
      const deal = dealMap.get(room.deal_id);
      const appt = apptMap.get(room.deal_id);
      if (!appt || !appt.walkthrough) continue;
      const wt = appt.walkthrough;
      const addr = deal?.property_address || 'a deal';

      if (wt.status === 'PROPOSED' && wt.updatedByUserId && wt.updatedByUserId !== profileId) {
        notifications.push({
          type: 'walkthrough_confirm',
          title: 'Walkthrough proposed — confirm dates',
          description: addr,
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: wt.updatedAt || appt.updated_date,
          priority: 'high',
        });
      }

      if (wt.status === 'SCHEDULED') {
        // Notify both parties walkthrough is confirmed (recent ones only)
        const ts = wt.updatedAt || appt.updated_date;
        if (ts && (Date.now() - new Date(ts).getTime()) < 3 * 86400000) {
          notifications.push({
            type: 'walkthrough_scheduled',
            title: 'Walkthrough confirmed ✓',
            description: `${addr}${wt.datetime ? ' — ' + new Date(wt.datetime).toLocaleDateString() : ''}`,
            roomId: room.id,
            dealId: room.deal_id,
            timestamp: ts,
            priority: 'low',
          });
        }
      }
    }

    // ─── 7. DEAL PROGRESS ACTIONS NEEDED ───
    for (const room of userRooms) {
      const deal = dealMap.get(room.deal_id);
      if (!deal) continue;
      const stage = deal.pipeline_stage || 'new_deals';
      const isSigned = room.agreement_status === 'fully_signed' || room.request_status === 'locked';
      const appt = apptMap.get(deal.id);
      const wtStatus = appt?.walkthrough?.status || 'NOT_SET';
      const docs = deal.documents || {};

      // Investor: schedule walkthrough
      if (stage === 'connected_deals' && isSigned && isInvestor && (wtStatus === 'NOT_SET' || wtStatus === 'CANCELED')) {
        notifications.push({
          type: 'action_needed',
          title: 'Schedule walkthrough',
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
        if (isAgent && docs.cma?.url && deal.list_price_confirmed && !docs.listing_agreement?.url) {
          notifications.push({ type: 'action_needed', title: 'Upload listing agreement', description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
        if (isAgent && docs.listing_agreement?.url && deal.list_price_confirmed && docs.cma?.url) {
          // Agent should confirm listing is live on MLS
          notifications.push({ type: 'action_needed', title: 'Confirm property listed on MLS', description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'low' });
        }
      }

      if (stage === 'active_listings' && isSigned) {
        if (isAgent && !docs.buyer_contract?.url) {
          notifications.push({ type: 'action_needed', title: "Upload buyer's contract", description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
        if (isInvestor && docs.buyer_contract?.url) {
          notifications.push({ type: 'action_needed', title: 'Move deal to closing', description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
      }

      if (stage === 'in_closing' && isInvestor) {
        notifications.push({ type: 'action_needed', title: 'Confirm deal closed?', description: deal.property_address || 'a deal', roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
      }
    }

    // ─── 8. RECENT ACTIVITY FEED (deal events, stage changes, file uploads, etc.) ───
    const recentCutoff = Date.now() - 7 * 86400000; // last 7 days
    for (const act of (activities || [])) {
      // Only show activities for this user's deals
      if (!act.deal_id || !userDealIds.has(act.deal_id)) continue;
      // Don't show activities triggered by this user
      if (act.actor_id === profileId) continue;
      // Only recent
      if (new Date(act.created_date).getTime() < recentCutoff) continue;

      const deal = dealMap.get(act.deal_id);
      const room = roomByDeal.get(act.deal_id);
      const addr = deal?.property_address || 'a deal';

      let title = null;
      let priority = 'low';

      switch (act.type) {
        case 'deal_created':
          if (isAgent) { title = `New deal submitted`; priority = 'high'; }
          break;
        case 'agent_accepted':
          if (isInvestor) { title = `${act.actor_name || 'An agent'} accepted your deal`; priority = 'high'; }
          break;
        case 'agent_locked_in':
          title = `${act.actor_name || 'Agent'} locked in on deal`; priority = 'high';
          break;
        case 'agent_rejected':
          if (isInvestor) { title = `${act.actor_name || 'An agent'} declined your deal`; priority = 'medium'; }
          break;
        case 'deal_stage_changed':
          title = act.message || 'Deal moved to a new stage';
          priority = 'medium';
          break;
        case 'file_uploaded':
          title = `New document uploaded`;
          priority = 'low';
          break;
        case 'photo_uploaded':
          title = `New photo uploaded`;
          priority = 'low';
          break;
        default:
          break;
      }

      if (title) {
        notifications.push({
          type: `activity_${act.type}`,
          title,
          description: addr,
          roomId: room?.id || act.room_id || null,
          dealId: act.deal_id,
          timestamp: act.created_date,
          priority,
        });
      }
    }

    // ─── DEDUPLICATE ───
    const seen = new Set();
    const deduped = notifications.filter(n => {
      const key = `${n.type}:${n.dealId || ''}:${n.roomId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ─── SORT: high first, then by timestamp desc ───
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