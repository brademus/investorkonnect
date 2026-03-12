import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    // FIX: Use DealInvite index for agents instead of Room.filter({}) which scans ALL rooms
    const [investorRooms, agentInvites] = await Promise.all([
      isInvestor ? base44.entities.Room.filter({ investorId: profileId }).catch(() => []) : Promise.resolve([]),
      isAgent ? base44.entities.DealInvite.filter({ agent_profile_id: profileId }).catch(() => []) : Promise.resolve([]),
    ]);

    const roomMap = new Map();
    (investorRooms || []).forEach(r => roomMap.set(r.id, r));

    // For agents: fetch only the specific rooms from their invites
    if (isAgent && agentInvites.length > 0) {
      const activeInvites = agentInvites.filter(i => i.status !== 'VOIDED' && i.status !== 'EXPIRED');
      const roomIds = [...new Set(activeInvites.map(inv => inv.room_id).filter(Boolean))];
      if (roomIds.length > 0) {
        const agentRooms = await base44.entities.Room.filter({ id: { $in: roomIds } }).catch(() => []);
        agentRooms.forEach(r => roomMap.set(r.id, r));
      }
    }

    const userRooms = [...roomMap.values()];
    const userDealIds = new Set(userRooms.map(r => r.deal_id).filter(Boolean));
    const userRoomIds = new Set(userRooms.map(r => r.id));

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
      isAgent ? Promise.resolve(agentInvites || []) : Promise.resolve([]),
      dealIdArray.length > 0
        ? base44.entities.DealAppointments.filter({ dealId: { $in: dealIdArray } }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const dealMap = new Map();
    (deals || []).forEach(d => dealMap.set(d.id, d));

    const apptMap = new Map();
    (appointments || []).forEach(a => { if (a.dealId) apptMap.set(a.dealId, a); });

    const notifications = [];

    // ─── 1. COUNTER OFFER PENDING ───
    for (const co of (counterOffers || [])) {
      const isForMe = (isInvestor && co.to_role === 'investor') ||
                      (isAgent && co.to_role === 'agent') ||
                      co.to_profile_id === profileId;
      if (isForMe) {
        const deal = dealMap.get(co.deal_id);
        const address = (deal?.property_address || '').split(',')[0] || 'a deal';
        notifications.push({
          type: 'deal_activity',
          title: 'Counter offer received',
          description: 'Review and accept or counter',
          subtitle: address,
          roomId: co.room_id,
          dealId: co.deal_id,
          timestamp: co.created_date,
          priority: 'high',
        });
      }
    }

    // ─── 2. AGENT: NEW DEAL INVITES ───
    if (isAgent) {
      for (const inv of (dealInvites || [])) {
        if (inv.status === 'PENDING_AGENT_SIGNATURE' || inv.status === 'INVITED') {
          const deal = dealMap.get(inv.deal_id);
          const address = (deal?.property_address || deal?.city || 'a deal').split(',')[0];
          notifications.push({
            type: 'deal_activity',
            title: 'New deal invitation',
            description: 'Sign the agreement to accept',
            subtitle: address,
            roomId: inv.room_id,
            dealId: inv.deal_id,
            timestamp: inv.created_date || inv.created_at_iso,
            priority: 'high',
          });
        }
      }
    }

    // ─── 3. DEAL ACTIVITY — "What happened → Next step" ───
    for (const room of userRooms) {
      const deal = dealMap.get(room.deal_id);
      if (!deal) continue;

      const address = (deal.property_address || '').split(',')[0] || 'a deal';
      const stage = deal.pipeline_stage || 'new_deals';
      const isSigned = room.agreement_status === 'fully_signed' || room.request_status === 'locked';
      const appt = apptMap.get(room.deal_id);
      const wtStatus = appt?.walkthrough?.status || 'NOT_SET';
      const docs = deal.documents || {};

      // Agreement needs re-signing
      if (room.requires_regenerate) {
        notifications.push({
          type: 'deal_activity',
          title: 'Agreement updated',
          description: 'Review and re-sign the updated terms',
          subtitle: address,
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: room.updated_date,
          priority: 'high',
        });
      }

      // Walkthrough proposed by other party
      const wt = appt?.walkthrough;
      if (wt?.status === 'PROPOSED' && wt?.updatedByUserId && wt.updatedByUserId !== profileId) {
        notifications.push({
          type: 'deal_activity',
          title: 'Walkthrough dates proposed',
          description: 'Confirm or propose new dates',
          subtitle: address,
          roomId: room.id,
          dealId: room.deal_id,
          timestamp: wt.updatedAt || appt.updated_date,
          priority: 'high',
        });
      }

      // Walkthrough confirmed (within 7 days)
      if ((wt?.status === 'SCHEDULED' || wt?.status === 'COMPLETED') && isSigned) {
        const confirmedAt = wt?.updatedAt ? new Date(wt.updatedAt) : null;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (confirmedAt && confirmedAt > sevenDaysAgo) {
          if (isAgent && !docs.cma?.url) {
            notifications.push({
              type: 'deal_activity',
              title: 'Walkthrough confirmed',
              description: 'Upload the CMA',
              subtitle: address,
              roomId: room.id,
              dealId: room.deal_id,
              timestamp: wt.updatedAt,
              priority: 'medium',
            });
          } else if (isInvestor) {
            notifications.push({
              type: 'deal_activity',
              title: 'Walkthrough confirmed',
              description: docs.cma?.url ? 'Review the estimated list price' : 'Waiting for agent to upload CMA',
              subtitle: address,
              roomId: room.id,
              dealId: room.deal_id,
              timestamp: wt.updatedAt,
              priority: 'low',
            });
          }
        }
      }

      if (!isSigned) continue;

      // ─── Connected Deals Stage ───
      if (stage === 'connected_deals') {
        if (isInvestor && docs.cma?.url && !deal.list_price_confirmed) {
          notifications.push({ type: 'deal_activity', title: 'CMA uploaded', description: 'Confirm or edit the list price', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: docs.cma.uploaded_at || deal.updated_date, priority: 'high' });
        }
        if (isAgent && docs.cma?.url && !deal.list_price_confirmed) {
          notifications.push({ type: 'deal_activity', title: 'CMA uploaded', description: 'Waiting for investor to confirm list price', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: docs.cma.uploaded_at || deal.updated_date, priority: 'low' });
        }
        if (isAgent && deal.list_price_confirmed && !docs.listing_agreement?.url) {
          notifications.push({ type: 'deal_activity', title: 'List price confirmed', description: 'Upload the listing agreement', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'high' });
        }
        if (isInvestor && deal.list_price_confirmed && !docs.listing_agreement?.url) {
          notifications.push({ type: 'deal_activity', title: 'List price confirmed', description: 'Waiting for agent to upload listing agreement', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'low' });
        }
        if (isAgent && docs.listing_agreement?.url) {
          notifications.push({ type: 'deal_activity', title: 'Listing agreement uploaded', description: 'Mark the listing as active on MLS', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: docs.listing_agreement.uploaded_at || deal.updated_date, priority: 'high' });
        }
        if (isInvestor && docs.listing_agreement?.url && deal.list_price_confirmed) {
          notifications.push({ type: 'deal_activity', title: 'Listing agreement uploaded', description: 'Waiting for agent to list on MLS', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: docs.listing_agreement.uploaded_at || deal.updated_date, priority: 'low' });
        }
        if (isInvestor && (wtStatus === 'NOT_SET' || wtStatus === 'CANCELED')) {
          notifications.push({ type: 'deal_activity', title: 'Deal connected', description: 'Schedule a walkthrough', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
        if (isAgent && (wtStatus === 'NOT_SET' || wtStatus === 'CANCELED') && !docs.cma?.url) {
          notifications.push({ type: 'deal_activity', title: 'Deal connected', description: 'Waiting for investor to schedule walkthrough', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'low' });
        }
      }

      // ─── Active Listings Stage ───
      if (stage === 'active_listings') {
        if (isAgent && !docs.buyer_contract?.url) {
          notifications.push({ type: 'deal_activity', title: 'Listing is active', description: "Upload the buyer's contract", subtitle: address, roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
        if (isInvestor && docs.buyer_contract?.url) {
          notifications.push({ type: 'deal_activity', title: "Buyer's contract received", description: 'Move deal to closing', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: docs.buyer_contract.uploaded_at || deal.updated_date, priority: 'high' });
        }
        if (isAgent && docs.buyer_contract?.url) {
          notifications.push({ type: 'deal_activity', title: "Buyer's contract uploaded", description: 'Waiting for investor to move to closing', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: docs.buyer_contract.uploaded_at || deal.updated_date, priority: 'low' });
        }
      }

      // ─── In Closing Stage ───
      if (stage === 'in_closing') {
        if (isInvestor) {
          notifications.push({ type: 'deal_activity', title: 'Deal is in closing', description: 'Confirm when the deal closes', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'medium' });
        }
        if (isAgent) {
          notifications.push({ type: 'deal_activity', title: 'Deal moved to closing', description: 'Waiting for investor to confirm close', subtitle: address, roomId: room.id, dealId: deal.id, timestamp: deal.updated_date, priority: 'low' });
        }
      }
    }

    // ─── DEDUPLICATE & SORT ───
    const seen = new Set();
    const deduped = notifications.filter(n => {
      const key = `${n.title}:${n.dealId || ''}:${n.roomId || ''}`;
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