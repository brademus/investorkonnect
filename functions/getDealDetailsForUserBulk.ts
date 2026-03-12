import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const dealIds = body?.dealIds;
    if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
      return Response.json({ deals: {} });
    }

    const ids = dealIds.slice(0, 20);

    const profileArr = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profileArr?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    // Fetch all data in parallel
    const allDealsPromise = base44.asServiceRole.entities.Deal.filter({ id: { $in: ids } }).catch(() => []);
    const allRoomsPromise = base44.asServiceRole.entities.Room.filter({ deal_id: { $in: ids } }).catch(() => []);
    const allAgreementsPromise = base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: ids } }).catch(() => []);

    const [allDeals, allRooms, allAgreements] = await Promise.all([allDealsPromise, allRoomsPromise, allAgreementsPromise]);

    // Build lookup maps
    const roomByDeal = {};
    for (const r of allRooms) {
      if (r.deal_id && !roomByDeal[r.deal_id]) roomByDeal[r.deal_id] = r;
    }

    const signedDeals = {};
    for (const a of allAgreements) {
      if (a.status === 'voided' || a.status === 'superseded') continue;
      if (a.status === 'fully_signed') signedDeals[a.deal_id] = true;
    }

    // Collect counterparty profile IDs
    const cpIds = new Set();
    for (const d of allDeals) {
      if (d.investor_id) cpIds.add(d.investor_id);
      if (d.locked_agent_id) cpIds.add(d.locked_agent_id);
      else if (d.agent_id) cpIds.add(d.agent_id);
    }

    let cpMap = {};
    if (cpIds.size > 0) {
      const cpProfiles = await base44.asServiceRole.entities.Profile.filter({ id: { $in: [...cpIds] } }).catch(() => []);
      for (const p of cpProfiles) {
        cpMap[p.id] = p;
      }
    }

    const result = {};

    for (const deal of allDeals) {
      // Access check
      if (!isAdmin) {
        if (isInvestor && deal.investor_id !== profile.id) continue;
        if (isAgent) {
          const room = roomByDeal[deal.id];
          const hasAccess = room && (room.agentId === profile.id || (room.agent_ids && room.agent_ids.includes(profile.id)));
          const inSelected = deal.selected_agent_ids && deal.selected_agent_ids.includes(profile.id);
          if (!hasAccess && !inSelected && deal.agent_id !== profile.id) continue;
        }
      }

      const isSigned = !!signedDeals[deal.id];
      const room = roomByDeal[deal.id] || null;

      const showInvestor = isSigned || isAgent || isAdmin;
      const showAgent = isSigned || isInvestor || isAdmin;

      const inv = showInvestor ? cpMap[deal.investor_id] : null;
      const ag = showAgent ? cpMap[deal.locked_agent_id || deal.agent_id] : null;

      const showFull = isAdmin || isInvestor || isSigned;

      result[deal.id] = {
        id: deal.id,
        title: deal.title,
        city: deal.city,
        state: deal.state,
        county: deal.county,
        zip: deal.zip,
        purchase_price: isAgent ? null : deal.purchase_price,
        estimated_list_price: deal.estimated_list_price || null,
        pipeline_stage: deal.pipeline_stage,
        status: deal.status,
        created_date: deal.created_date,
        updated_date: deal.updated_date,
        key_dates: deal.key_dates || null,
        investor_id: deal.investor_id,
        agent_id: deal.agent_id,
        locked_agent_id: deal.locked_agent_id || null,
        selected_agent_ids: deal.selected_agent_ids || [],
        is_fully_signed: isSigned,
        proposed_terms: deal.proposed_terms || null,
        property_type: deal.property_type || null,
        deal_type: deal.deal_type || null,
        documents: deal.documents || null,
        list_price_confirmed: deal.list_price_confirmed || false,
        contract_document: deal.contract_document || null,
        contract_url: deal.contract_url || null,
        walkthrough_scheduled: deal.walkthrough_scheduled || null,
        walkthrough_date: deal.walkthrough_date || null,
        walkthrough_time: deal.walkthrough_time || null,
        walkthrough_slots: deal.walkthrough_slots || [],
        walkthrough_confirmed: deal.walkthrough_confirmed || false,
        walkthrough_confirmed_date: deal.walkthrough_confirmed_date || null,
        walkthrough_confirmed_time: deal.walkthrough_confirmed_time || null,
        investor_full_name: inv ? (inv.full_name || null) : null,
        investor_contact: inv ? { email: inv.email, phone: inv.phone, company: inv.company || (inv.investor ? inv.investor.company_name : null), company_address: inv.company_address, headshotUrl: inv.headshotUrl } : null,
        agent_full_name: ag ? (ag.full_name || null) : null,
        agent_contact: ag ? { email: ag.email, phone: ag.phone, company: (ag.agent ? ag.agent.brokerage : null) || ag.broker || ag.company, company_address: ag.company_address, headshotUrl: ag.headshotUrl } : null,
        room: room ? { id: room.id, proposed_terms: room.proposed_terms || null, agent_terms: room.agent_terms || null, agent_ids: room.agent_ids || [] } : null,
        property_address: showFull ? deal.property_address : null,
        property_details: showFull ? deal.property_details : null,
        seller_info: showFull ? deal.seller_info : null,
        notes: showFull ? deal.notes : null,
        special_notes: showFull ? deal.special_notes : null,
      };
    }

    return Response.json({ deals: result });
  } catch (error) {
    console.error('[getDealDetailsForUserBulk] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});