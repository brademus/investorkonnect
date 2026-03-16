import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Get pipeline deals + room data for current user with role-based redaction.
 * V3: Returns both deals AND enriched room data in a single call so Pipeline
 * doesn't need a second call to listMyRoomsEnriched.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    // Team support: if this user is a team member, load the owner's deals instead
    let effectiveProfileId = profile.id;
    let teamRole = null; // null = owner/solo, 'admin' or 'viewer'
    if (profile.team_owner_id) {
      effectiveProfileId = profile.team_owner_id;
      // Look up the team seat to get the team_role
      try {
        const seats = await base44.asServiceRole.entities.TeamSeat.filter({ 
          owner_profile_id: profile.team_owner_id, 
          member_profile_id: profile.id, 
          status: 'active' 
        });
        teamRole = seats[0]?.team_role || 'viewer';
      } catch (_) {
        teamRole = 'viewer';
      }
    }

    let deals = [];
    let rooms = [];

    if (isAdmin && !profile.team_owner_id) {
      const [d, r] = await Promise.all([
        base44.asServiceRole.entities.Deal.list('-updated_date', 100),
        base44.asServiceRole.entities.Room.list('-updated_date', 100),
      ]);
      deals = d;
      rooms = r;
    } else if (isInvestor || profile.team_owner_id) {
      const [d, r] = await Promise.all([
        base44.asServiceRole.entities.Deal.filter({ investor_id: effectiveProfileId, status: { $ne: 'draft' } }),
        base44.asServiceRole.entities.Room.filter({ investorId: effectiveProfileId }),
      ]);
      deals = d;
      rooms = r;
    } else if (isAgent) {
      // Use DealInvite index — no full-table scan
      const [invites, directDeals] = await Promise.all([
        base44.asServiceRole.entities.DealInvite.filter({ agent_profile_id: effectiveProfileId }),
        base44.asServiceRole.entities.Deal.filter({ agent_id: effectiveProfileId }),
      ]);
      const activeInvites = invites.filter(i => i.status !== 'VOIDED' && i.status !== 'EXPIRED');
      const inviteDealIds = activeInvites.map(i => i.deal_id).filter(Boolean);
      const directIds = directDeals.map(d => d.id);
      const allIds = [...new Set([...inviteDealIds, ...directIds])];

      // Fetch rooms from invites
      const roomIds = [...new Set(activeInvites.map(i => i.room_id).filter(Boolean))];

      const [dealRes, roomRes] = await Promise.all([
        allIds.length > 0 ? base44.asServiceRole.entities.Deal.filter({ id: { $in: allIds } }) : Promise.resolve([]),
        roomIds.length > 0 ? base44.asServiceRole.entities.Room.filter({ id: { $in: roomIds } }) : Promise.resolve([]),
      ]);
      deals = dealRes.filter(d => !d.locked_agent_id || d.locked_agent_id === effectiveProfileId);
      rooms = roomRes;
    }

    // Deduplicate deals by ID
    const map = new Map();
    deals.filter(d => d?.id && d.status !== 'archived').forEach(d => {
      const prev = map.get(d.id);
      if (!prev || new Date(d.updated_date || 0) > new Date(prev.updated_date || 0)) map.set(d.id, d);
    });

    // Deduplicate by investor_id + normalized property_address
    const normAddr = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const addrMap = new Map();
    for (const [id, deal] of map) {
      const key = `${deal.investor_id || ''}|${normAddr(deal.property_address)}`;
      if (!key || key === '|') continue;
      const prev = addrMap.get(key);
      if (!prev || new Date(deal.updated_date || 0) > new Date(prev.updated_date || 0)) {
        if (prev) map.delete(prev.id);
        addrMap.set(key, deal);
      } else {
        map.delete(id);
      }
    }

    // Load agreements + counters + counterparty profiles in parallel
    const dealIds = [...map.keys()];
    const roomIds = rooms.map(r => r.id);

    // Collect counterparty IDs
    const cpIds = new Set();
    rooms.forEach(r => {
      if (isInvestor || isAdmin) {
        (r.agent_ids || []).forEach(id => cpIds.add(id));
        if (r.locked_agent_id) cpIds.add(r.locked_agent_id);
      } else {
        if (r.investorId) cpIds.add(r.investorId);
      }
    });

    const [allAgreements, allCounters, cpProfiles] = await Promise.all([
      dealIds.length > 0 ? base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: dealIds } }) : Promise.resolve([]),
      roomIds.length > 0 ? base44.asServiceRole.entities.CounterOffer.filter({ room_id: { $in: roomIds }, status: 'pending' }).catch(() => []) : Promise.resolve([]),
      cpIds.size > 0 ? base44.asServiceRole.entities.Profile.filter({ id: { $in: [...cpIds] } }) : Promise.resolve([]),
    ]);

    // Build agreement map (best per deal)
    const agreementMap = new Map();
    const statusRank = s => ({ fully_signed: 5, attorney_review_pending: 4, agent_signed: 3, investor_signed: 2, sent: 1 }[s] || 0);
    allAgreements.forEach(a => {
      if (['voided', 'superseded'].includes(a.status)) return;
      const prev = agreementMap.get(a.deal_id);
      if (!prev || statusRank(a.status) > statusRank(prev.status)) agreementMap.set(a.deal_id, a);
    });

    // Build room map (best per deal_id)
    const roomByDeal = new Map();
    rooms.filter(r => r.request_status !== 'expired').forEach(r => {
      if (!r.deal_id) return;
      const prev = roomByDeal.get(r.deal_id);
      const score = x => (x.agreement_status === 'fully_signed' ? 3 : x.request_status === 'accepted' ? 2 : 1);
      if (!prev || score(r) > score(prev)) roomByDeal.set(r.deal_id, r);
    });

    // Build counter map
    const counterMap = new Map();
    allCounters.forEach(c => { if (!counterMap.has(c.room_id)) counterMap.set(c.room_id, c); });

    // Build profile map
    const profileMap = new Map(cpProfiles.map(p => [p.id, p]));

    // Redact and enrich
    const redacted = [...map.values()].map(deal => {
      const ag = agreementMap.get(deal.id);
      const room = roomByDeal.get(deal.id);
      const isSigned = ag?.status === 'fully_signed' || ag?.status === 'attorney_review_pending';
      const exhibitTerms = ag?.exhibit_a_terms || null;
      const finalProposedTerms = exhibitTerms ? { ...(deal.proposed_terms || {}), ...exhibitTerms } : deal.proposed_terms;

      // Counterparty info
      const cpId = (isInvestor || isAdmin)
        ? (deal.locked_agent_id || room?.locked_agent_id || room?.agent_ids?.[0])
        : room?.investorId;
      const cp = cpId ? profileMap.get(cpId) : null;

      const counter = room ? counterMap.get(room.id) : null;

      const base = {
        id: deal.id, title: deal.title, city: deal.city, state: deal.state, county: deal.county, zip: deal.zip,
        purchase_price: isAgent ? null : deal.purchase_price,
        estimated_list_price: deal.estimated_list_price || null,
        pipeline_stage: deal.pipeline_stage, status: deal.status,
        created_date: deal.created_date, updated_date: deal.updated_date, key_dates: deal.key_dates,
        investor_id: deal.investor_id, agent_id: deal.agent_id,
        locked_room_id: deal.locked_room_id, locked_agent_id: deal.locked_agent_id,
        selected_agent_ids: deal.selected_agent_ids, is_fully_signed: isSigned,
        proposed_terms: finalProposedTerms,
        walkthrough_scheduled: deal.walkthrough_scheduled,
        walkthrough_date: deal.walkthrough_date,
        walkthrough_time: deal.walkthrough_time,
        walkthrough_slots: deal.walkthrough_slots,
        documents: deal.documents || null,
        list_price_confirmed: deal.list_price_confirmed || false,
        agreement_exhibit_a_terms: exhibitTerms,
      };

      // Room data inline (eliminates need for separate listMyRoomsEnriched call)
      if (room) {
        base.room_id = room.id;
        base.room_request_status = room.request_status;
        base.room_agreement_status = room.agreement_status;
        base.room_is_fully_signed = room.agreement_status === 'fully_signed' || room.request_status === 'locked' || isSigned;
        base.room_counterparty_name = cp?.full_name || null;
        base.room_counterparty_headshot = cp?.headshotUrl || null;
        base.room_counterparty_id = cpId || null;
        base.room_investorId = room.investorId;
        base.room_agent_ids = room.agent_ids || [];
        base.room_agent_terms = room.agent_terms || null;
        base.room_proposed_terms = room.proposed_terms || null;
        base.room_requires_regenerate = room.requires_regenerate || false;
        base.room_files = room.files || [];
        base.room_photos = room.photos || [];
        base.pending_counter_offer = counter ? { id: counter.id, from_role: counter.from_role, status: counter.status } : null;
        // Agreement info for badges
        base.agreement = ag ? {
          status: ag.status,
          investor_signed_at: ag.investor_signed_at,
          agent_signed_at: ag.agent_signed_at,
          exhibit_a_terms: exhibitTerms,
        } : null;
      }

      if (isAdmin || isInvestor || isSigned) {
        return { ...base, property_address: deal.property_address, seller_info: deal.seller_info, property_details: deal.property_details, special_notes: deal.special_notes };
      }
      return { ...base, property_address: null, seller_info: null, property_details: null, special_notes: null };
    });

    return Response.json({ deals: redacted, role: profile.user_role, team_role: teamRole });
  } catch (error) {
    console.error('[getPipelineDeals] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});