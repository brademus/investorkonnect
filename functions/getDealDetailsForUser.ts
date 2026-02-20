import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get single deal details with role-based access control.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dealId } = await req.json();
    if (!dealId) return Response.json({ error: 'dealId required' }, { status: 400 });

    // Fetch profile and deal in parallel
    const [profileArr, deal] = await Promise.all([
      base44.asServiceRole.entities.Profile.filter({ user_id: user.id }),
      base44.asServiceRole.entities.Deal.get(dealId).catch(() => null)
    ]);

    const profile = profileArr?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    // Fetch rooms + agreements in parallel (needed for access check AND response)
    const [rooms, agreements] = await Promise.all([
      base44.asServiceRole.entities.Room.filter({ deal_id: dealId }),
      base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: dealId })
    ]);

    // Access check
    if (!isAdmin) {
      if (isInvestor && deal.investor_id !== profile.id) return Response.json({ error: 'Access denied' }, { status: 403 });
      if (isAgent) {
        const hasAccess = rooms.some(r => r.agentId === profile.id || r.agent_ids?.includes(profile.id));
        const inSelected = deal.selected_agent_ids?.includes(profile.id);
        if (!hasAccess && !inSelected && deal.agent_id !== profile.id) return Response.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const isSigned = agreements?.some(a => a.status === 'fully_signed') || false;

    // Resolve counterpart names in parallel
    const showInvestorInfo = isSigned || isAgent || isAdmin;
    const showAgentInfo = isSigned || isInvestor || isAdmin;

    const [invP, agP] = await Promise.all([
      (showInvestorInfo && deal.investor_id) ? base44.asServiceRole.entities.Profile.filter({ id: deal.investor_id }) : Promise.resolve([]),
      (showAgentInfo && deal.agent_id) ? base44.asServiceRole.entities.Profile.filter({ id: deal.agent_id }) : Promise.resolve([])
    ]);

    const inv = invP?.[0];
    const ag = agP?.[0];
    const investorName = inv?.full_name || null;
    const investorContact = inv ? { email: inv.email, phone: inv.phone, company: inv.company || inv.investor?.company_name, company_address: inv.company_address, headshotUrl: inv.headshotUrl } : null;
    const agentName = ag?.full_name || null;
    const agentContact = ag ? { email: ag.email, phone: ag.phone, company: ag.agent?.brokerage || ag.broker || ag.company, company_address: ag.company_address, headshotUrl: ag.headshotUrl } : null;

    const room = rooms?.[0];

    const base = {
      id: deal.id, title: deal.title, city: deal.city, state: deal.state, county: deal.county, zip: deal.zip,
      purchase_price: deal.purchase_price, pipeline_stage: deal.pipeline_stage, status: deal.status,
      created_date: deal.created_date, updated_date: deal.updated_date, key_dates: deal.key_dates,
      investor_id: deal.investor_id, agent_id: deal.agent_id,
      property_type: deal.property_type, property_details: deal.property_details,
      contract_document: deal.contract_document, contract_url: deal.contract_url,
      is_fully_signed: isSigned, investor_full_name: investorName, agent_full_name: agentName,
      investor_contact: investorContact, agent_contact: agentContact,
      proposed_terms: deal.proposed_terms || null,
      walkthrough_scheduled: deal.walkthrough_scheduled ?? null,
      walkthrough_date: deal.walkthrough_date || null,
      walkthrough_time: deal.walkthrough_time || null,
      walkthrough_confirmed: deal.walkthrough_confirmed ?? false,
      walkthrough_confirmed_date: deal.walkthrough_confirmed_date || null,
      walkthrough_confirmed_time: deal.walkthrough_confirmed_time || null,
      walkthrough_slots: deal.walkthrough_slots || [],
      deal_type: deal.deal_type || null,
      locked_agent_id: deal.locked_agent_id || null,
      selected_agent_ids: deal.selected_agent_ids || [],
      room: room ? { id: room.id, proposed_terms: room.proposed_terms || null, agent_terms: room.agent_terms || null, agent_ids: room.agent_ids || [] } : null
    };

    if (isAdmin || isInvestor || isSigned) {
      return Response.json({
        ...base, property_address: deal.property_address, seller_info: deal.seller_info,
        documents: deal.documents, notes: deal.notes, special_notes: deal.special_notes
      });
    }

    return Response.json({
      ...base, property_address: null, seller_info: null, notes: null, special_notes: null,
      documents: deal.documents || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});