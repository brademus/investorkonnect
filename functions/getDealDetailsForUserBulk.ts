import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Batch-fetch deal details for multiple deals in a single call.
 * Used by the Room page to pre-load all deals in the sidebar.
 * Payload: { dealIds: string[] }
 * Returns: { deals: { [dealId]: dealObject } }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dealIds } = await req.json();
    if (!dealIds?.length) return Response.json({ deals: {} });

    // Limit to 20 deals max
    const ids = dealIds.slice(0, 20);

    const [profileArr, allDeals, allRooms, allAgreements] = await Promise.all([
      base44.asServiceRole.entities.Profile.filter({ user_id: user.id }),
      base44.asServiceRole.entities.Deal.filter({ id: { $in: ids } }).catch(() => []),
      base44.asServiceRole.entities.Room.filter({ deal_id: { $in: ids } }).catch(() => []),
      base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: ids } }).catch(() => []),
    ]);

    const profile = profileArr?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    // Build lookup maps
    const roomByDeal = new Map();
    allRooms.forEach(r => { if (r.deal_id && !roomByDeal.has(r.deal_id)) roomByDeal.set(r.deal_id, r); });

    const signedDeals = new Set();
    const rank = s => ({ fully_signed: 5, attorney_review_pending: 4, agent_signed: 3, investor_signed: 2, sent: 1 }[s] || 0);
    allAgreements.forEach(a => {
      if (['voided', 'superseded'].includes(a.status)) return;
      if (a.status === 'fully_signed') signedDeals.add(a.deal_id);
    });

    // Collect counterparty profile IDs
    const cpIds = new Set();
    allDeals.forEach(d => {
      if (d.investor_id) cpIds.add(d.investor_id);
      if (d.locked_agent_id) cpIds.add(d.locked_agent_id);
      else if (d.agent_id) cpIds.add(d.agent_id);
    });

    const cpProfiles = cpIds.size > 0
      ? await base44.asServiceRole.entities.Profile.filter({ id: { $in: [...cpIds] } }).catch(() => [])
      : [];
    const cpMap = new Map(cpProfiles.map(p => [p.id, p]));

    // Build response
    const result = {};
    for (const deal of allDeals) {
      // Access check
      if (!isAdmin) {
        if (isInvestor && deal.investor_id !== profile.id) continue;
        if (isAgent) {
          const room = roomByDeal.get(deal.id);
          const hasAccess = room && (room.agentId === profile.id || room.agent_ids?.includes(profile.id));
          const inSelected = deal.selected_agent_ids?.includes(profile.id);
          if (!hasAccess && !inSelected && deal.agent_id !== profile.id) continue;
        }
      }

      const isSigned = signedDeals.has(deal.id);
      const room = roomByDeal.get(deal.id);

      const showInvestor = isSigned || isAgent || isAdmin;
      const showAgent = isSigned || isInvestor || isAdmin;

      const inv = showInvestor ? cpMap.get(deal.investor_id) : null;
      const ag = showAgent ? cpMap.get(deal.locked_agent_id || deal.agent_id) : null;

      const base = {
        id: deal.id, title: deal.title, city: deal.city, state: deal.state,
        county: deal.county, zip: deal.zip,
        purchase_price: isAgent ? null : deal.purchase_price,
        estimated_list_price: deal.estimated_list_price || null,
        pipeline_stage: deal.pipeline_stage, status: deal.status,
        created_date: deal.created_date, updated_date: deal.updated_date,
        key_dates: deal.key_dates,
        investor_id: deal.investor_id, agent_id: deal.agent_id,
        locked_agent_id: deal.locked_agent_id || null,
        selected_agent_ids: deal.selected_agent_ids || [],
        is_fully_signed: isSigned,
        proposed_terms: deal.proposed_terms || null,
        property_type: deal.property_type,
        deal_type: deal.deal_type || null,
        documents: deal.documents || null,
        list_price_confirmed: deal.list_price_confirmed || false,
        contract_document: deal.contract_document || null,
        contract_url: deal.contract_url || null,
        walkthrough_scheduled: deal.walkthrough_scheduled ?? null,
        walkthrough_date: deal.walkthrough_date || null,
        walkthrough_time: deal.walkthrough_time || null,
        walkthrough_slots: deal.walkthrough_slots || [],
        walkthrough_confirmed: deal.walkthrough_confirmed ?? false,
        walkthrough_confirmed_date: deal.walkthrough_confirmed_date || null,
        walkthrough_confirmed_time: deal.walkthrough_confirmed_time || null,
        investor_full_name: inv?.full_name || null,
        investor_contact: inv ? { email: inv.email, phone: inv.phone, company: inv.company || inv.investor?.company_name, company_address: inv.company_address, headshotUrl: inv.headshotUrl } : null,
        agent_full_name: ag?.full_name || null,
        agent_contact: ag ? { email: ag.email, phone: ag.phone, company: ag.agent?.brokerage || ag.broker || ag.company, company_address: ag.company_address, headshotUrl: ag.headshotUrl } : null,
        room: room ? { id: room.id, proposed_terms: room.proposed_terms || null, agent_terms: room.agent_terms || null, agent_ids: room.agent_ids || [] } : null,
      };

      if (isAdmin || isInvestor || isSigned) {
        result[deal.id] = {
          ...base,
          property_address: deal.property_address,
          property_details: deal.property_details,
          seller_info: deal.seller_info,
          notes: deal.notes,
          special_notes: deal.special_notes,
        };
      } else {
        result[deal.id] = {
          ...base,
          property_address: null,
          property_details: null,
          seller_info: null,
          notes: null,
          special_notes: null,
        };
      }
    }

    return Response.json({ deals: result });
  } catch (error) {
    console.error('[getDealDetailsForUserBulk] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});