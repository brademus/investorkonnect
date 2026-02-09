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

    const isInvestor = profile.user_role === 'investor';
    const isAgent = profile.user_role === 'agent';

    // Get rooms
    let rooms = [];
    if (isInvestor) {
      rooms = await base44.asServiceRole.entities.Room.filter({ investorId: profile.id });
    } else if (isAgent) {
      const allRooms = await base44.asServiceRole.entities.Room.list('-created_date', 200);
      rooms = allRooms.filter(r => r.agent_ids?.includes(profile.id) || r.agentId === profile.id);
    }

    // Filter out expired
    rooms = rooms.filter(r => r.request_status !== 'expired');

    // Batch-load deals + counterparty profiles + agreements
    const dealIds = [...new Set(rooms.map(r => r.deal_id).filter(Boolean))];
    const counterpartyIds = [...new Set(rooms.map(r => isInvestor ? (r.agent_ids?.[0] || r.agentId) : r.investorId).filter(Boolean))];

    const [allDeals, allProfiles, allAgreements, allCounters] = await Promise.all([
      dealIds.length ? base44.asServiceRole.entities.Deal.filter({ id: { $in: dealIds } }) : [],
      counterpartyIds.length ? base44.asServiceRole.entities.Profile.filter({ id: { $in: counterpartyIds } }) : [],
      dealIds.length ? base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: dealIds } }) : [],
      rooms.length ? base44.asServiceRole.entities.CounterOffer.filter({ room_id: { $in: rooms.map(r => r.id) }, status: 'pending' }).catch(() => []) : []
    ]);

    const dealMap = new Map(allDeals.map(d => [d.id, d]));
    const profileMap = new Map(allProfiles.map(p => [p.id, p]));
    const agreementMap = new Map();
    allAgreements.forEach(a => { if (!agreementMap.has(a.deal_id)) agreementMap.set(a.deal_id, a); });
    const counterMap = new Map();
    allCounters.forEach(c => { if (!counterMap.has(c.room_id)) counterMap.set(c.room_id, c); });

    // Enrich rooms
    const enriched = rooms.map(room => {
      const deal = dealMap.get(room.deal_id);
      const cpId = isInvestor ? (room.agent_ids?.[0] || room.agentId) : room.investorId;
      const cp = profileMap.get(cpId);
      const ag = agreementMap.get(room.deal_id);
      const counter = counterMap.get(room.id);
      const isSigned = room.agreement_status === 'fully_signed' || room.request_status === 'signed' || ag?.status === 'fully_signed';

      // For agents: filter out deals locked to another agent
      if (isAgent && deal?.locked_agent_id && deal.locked_agent_id !== profile.id) return null;

      return {
        id: room.id, deal_id: room.deal_id,
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
        proposed_terms: room.proposed_terms || deal?.proposed_terms,
        // Agreement status for badges
        agreement: ag ? { status: ag.status, investor_signed_at: ag.investor_signed_at, agent_signed_at: ag.agent_signed_at } : null,
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