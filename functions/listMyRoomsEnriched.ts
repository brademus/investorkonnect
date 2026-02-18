import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Enriched rooms list - returns rooms with counterparty names, deal summaries, and agreement status.
 * Simplified v2: no legacy entities, no message attachment scanning, clean logic.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isInvestor = profile.user_role === 'investor' || isAdmin;
    const isAgent = !isAdmin && profile.user_role === 'agent';

    // Get rooms - limit scope to avoid timeouts
    let rooms = [];
    if (isAdmin) {
      // Admin: get recent rooms only (small batch)
      rooms = await base44.asServiceRole.entities.Room.list('-updated_date', 30);
    } else if (isInvestor) {
      rooms = await base44.asServiceRole.entities.Room.filter({ investorId: profile.id });
    } else if (isAgent) {
      const invites = await base44.asServiceRole.entities.DealInvite.filter({ agent_profile_id: profile.id });
      const activeInvites = invites.filter(i => i.status !== 'VOIDED' && i.status !== 'EXPIRED');
      const roomIds = activeInvites.map(i => i.room_id).filter(Boolean);
      if (roomIds.length > 0) {
        rooms = await base44.asServiceRole.entities.Room.filter({ id: { $in: roomIds } });
      }
    }

    rooms = rooms.filter(r => r.request_status !== 'expired');

    // Early return if no rooms
    if (rooms.length === 0) {
      return Response.json({ rooms: [], count: 0 });
    }

    // Collect IDs for batch fetching
    const allDealIds = [...new Set(rooms.map(r => r.deal_id).filter(Boolean))];
    const roomIds = rooms.map(r => r.id);

    // Batch 1: deals + agreements + counters in parallel
    const [prefetchDeals, allAgreements, allCounters] = await Promise.all([
      allDealIds.length ? base44.asServiceRole.entities.Deal.filter({ id: { $in: allDealIds } }) : [],
      allDealIds.length ? base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: allDealIds } }) : [],
      base44.asServiceRole.entities.CounterOffer.filter({ room_id: { $in: roomIds }, status: 'pending' }).catch(() => [])
    ]);
    const prefetchDealMap = new Map(prefetchDeals.map(d => [d.id, d]));
    const allDeals = prefetchDeals;
    const dealIds = allDealIds;

    // Collect counterparty IDs from rooms + deals
    const allAgentIds = new Set();
    rooms.forEach(r => {
      if (isInvestor) {
        const deal = prefetchDealMap.get(r.deal_id);
        const agentId = deal?.locked_agent_id || r.locked_agent_id || r.agent_ids?.[0] || r.agentId;
        if (agentId) allAgentIds.add(agentId);
        (r.agent_ids || []).forEach(id => allAgentIds.add(id));
      } else {
        if (r.investorId) allAgentIds.add(r.investorId);
      }
    });
    const counterpartyIds = [...allAgentIds];

    // Batch 2: profiles
    const allProfiles = counterpartyIds.length ? await base44.asServiceRole.entities.Profile.filter({ id: { $in: counterpartyIds } }) : [];

    const dealMap = new Map(allDeals.map(d => [d.id, d]));
    const profileMap = new Map(allProfiles.map(p => [p.id, p]));
    // Map agreements by room_id first (preferred), then fall back to deal_id
    const agreementByRoom = new Map();
    const agreementByDeal = new Map();
    allAgreements.forEach(a => {
      if (a.room_id && !agreementByRoom.has(a.room_id)) agreementByRoom.set(a.room_id, a);
      if (!agreementByDeal.has(a.deal_id)) agreementByDeal.set(a.deal_id, a);
    });
    const counterMap = new Map();
    allCounters.forEach(c => { if (!counterMap.has(c.room_id)) counterMap.set(c.room_id, c); });

    // Build a map of the best (most current, non-voided/superseded) agreement per room
    // so we can use exhibit_a_terms as the authoritative compensation source
    const bestAgreementByRoom = new Map();
    for (const a of allAgreements) {
      if (['voided', 'superseded'].includes(a.status)) continue;
      const key = a.room_id || a.deal_id;
      const prev = bestAgreementByRoom.get(key);
      // Prefer fully_signed > agent_signed > investor_signed > sent > draft
      const statusRank = s => ({ fully_signed: 5, attorney_review_pending: 4, agent_signed: 3, investor_signed: 2, sent: 1 }[s] || 0);
      if (!prev || statusRank(a.status) > statusRank(prev.status) || (statusRank(a.status) === statusRank(prev.status) && new Date(a.updated_date || 0) > new Date(prev.updated_date || 0))) {
        bestAgreementByRoom.set(key, a);
      }
    }

    // Enrich rooms
    const enriched = rooms.map(room => {
      const deal = dealMap.get(room.deal_id);
      const cpId = isInvestor ? (deal?.locked_agent_id || room.locked_agent_id || room.agent_ids?.[0] || room.agentId) : room.investorId;
      const cp = profileMap.get(cpId);
      const ag = agreementByRoom.get(room.id) || agreementByDeal.get(room.deal_id);
      const counter = counterMap.get(room.id);
      const isSigned = room.agreement_status === 'fully_signed' || room.request_status === 'signed' || ag?.status === 'fully_signed';

      // For agents: filter out deals locked to another agent
      if (isAgent && deal?.locked_agent_id && deal.locked_agent_id !== profile.id) return null;

      // Get the best agreement for this room to extract exhibit_a_terms (authoritative after regen)
      const bestAg = bestAgreementByRoom.get(room.id) || bestAgreementByRoom.get(room.deal_id);
      const exhibitTerms = bestAg?.exhibit_a_terms || null;

      return {
        id: room.id, deal_id: room.deal_id,
        agent_ids: room.agent_ids || [],
        agentId: deal?.locked_agent_id || room.locked_agent_id || room.agent_ids?.[0] || null,
        investorId: room.investorId,
        request_status: room.request_status, agreement_status: room.agreement_status,
        created_date: room.created_date, updated_date: room.updated_date,
        counterparty_id: cpId, counterparty_name: cp?.full_name || 'Unknown',
        counterparty_headshot: cp?.headshotUrl || null,
        counterparty_role: isInvestor ? 'agent' : 'investor',
        is_fully_signed: isSigned,
        pending_counter_offer: counter ? { id: counter.id, from_role: counter.from_role, status: counter.status } : null,
        // Deal fields
        title: deal?.title || room.title,
        property_address: (isInvestor || isSigned) ? (deal?.property_address || room.property_address) : null,
        city: deal?.city || room.city, state: deal?.state || room.state,
        budget: deal?.purchase_price || room.budget || 0,
        pipeline_stage: deal?.pipeline_stage,
        closing_date: deal?.key_dates?.closing_date,
        proposed_terms: (() => {
          // Priority: exhibit_a_terms from agreement (post-regen authoritative) > agent_terms > room terms > deal terms
          const baseTerms = room.proposed_terms || deal?.proposed_terms || {};
          
          // If agreement has exhibit_a_terms and isn't pending regeneration, those are authoritative
          if (exhibitTerms && !room.requires_regenerate) {
            return { ...baseTerms, ...exhibitTerms };
          }
          
          // If viewing as agent, merge agent-specific terms (from accepted counter offers)
          if (isAgent && room.agent_terms && room.agent_terms[profile.id]) {
            return { ...baseTerms, ...room.agent_terms[profile.id] };
          }
          // For investor: if room has only one agent with custom terms, show those
          if (isInvestor && room.agent_terms) {
            const agentIds = Object.keys(room.agent_terms);
            if (agentIds.length === 1) {
              return { ...baseTerms, ...room.agent_terms[agentIds[0]] };
            }
          }
          return baseTerms;
        })(),
        // Agreement status for badges + exhibit_a_terms for compensation display
        agreement: ag ? { status: ag.status, investor_signed_at: ag.investor_signed_at, agent_signed_at: ag.agent_signed_at, exhibit_a_terms: (bestAg || ag)?.exhibit_a_terms || null } : null,
        requires_regenerate: room.requires_regenerate || false,
        agent_terms: room.agent_terms || null,
        // Files/photos from room
        files: room.files || [], photos: room.photos || []
      };
    }).filter(Boolean);

    return Response.json({ rooms: enriched, count: enriched.length });
  } catch (error) {
    console.error('[listMyRoomsEnriched] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});