import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get single deal details with role-based access control.
 * Simplified v2: clean access checks, no legacy fallbacks.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dealId } = await req.json();
    if (!dealId) return Response.json({ error: 'dealId required' }, { status: 400 });

    const [profileArr, dealArr] = await Promise.all([
      base44.entities.Profile.filter({ user_id: user.id }),
      base44.entities.Deal.filter({ id: dealId })
    ]);
    const profile = profileArr?.[0];
    const deal = dealArr?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    // Access check
    if (!isAdmin) {
      if (isInvestor && deal.investor_id !== profile.id) return Response.json({ error: 'Access denied' }, { status: 403 });
      if (isAgent) {
        const rooms = await base44.entities.Room.filter({ deal_id: dealId });
        const hasAccess = rooms.some(r => r.agentId === profile.id || r.agent_ids?.includes(profile.id));
        const inSelected = deal.selected_agent_ids?.includes(profile.id);
        if (!hasAccess && !inSelected && deal.agent_id !== profile.id) return Response.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Check signing status
    let isSigned = false;
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: dealId });
    if (agreements?.length) isSigned = agreements[0].status === 'fully_signed';

    // Resolve counterpart names and contact info
    // Agents can always see investor info; investors see agent info only after signing
    let investorName = null, agentName = null;
    let investorContact = null, agentContact = null;
    const showInvestorInfo = isSigned || isAgent || isAdmin;
    const showAgentInfo = isSigned || isInvestor || isAdmin;

    const [invP, agP] = await Promise.all([
      (showInvestorInfo && deal.investor_id) ? base44.asServiceRole.entities.Profile.filter({ id: deal.investor_id }) : Promise.resolve([]),
      (showAgentInfo && deal.agent_id) ? base44.asServiceRole.entities.Profile.filter({ id: deal.agent_id }) : Promise.resolve([])
    ]);
    const inv = invP?.[0];
    const ag = agP?.[0];
    if (inv) {
      investorName = inv.full_name || null;
      investorContact = {
        email: inv.email || null,
        phone: inv.phone || null,
        company: inv.company || inv.investor?.company_name || null,
        company_address: inv.company_address || null,
        headshotUrl: inv.headshotUrl || null
      };
    }
    if (ag) {
      agentName = ag.full_name || null;
      agentContact = {
        email: ag.email || null,
        phone: ag.phone || null,
        company: ag.agent?.brokerage || ag.broker || ag.company || null,
        company_address: ag.company_address || null,
        headshotUrl: ag.headshotUrl || null
      };
    }

    // Get room for proposed_terms
    const rooms = await base44.entities.Room.filter({ deal_id: dealId });
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
      walkthrough_datetime: deal.walkthrough_datetime || null,
      room: room ? { id: room.id, proposed_terms: room.proposed_terms || null, agent_terms: room.agent_terms || null, agent_ids: room.agent_ids || [] } : null
    };

    if (isAdmin || isInvestor || isSigned) {
      return Response.json({
        ...base, property_address: deal.property_address, seller_info: deal.seller_info,
        documents: deal.documents, notes: deal.notes, special_notes: deal.special_notes
      });
    }

    // Agent: limited until signed
    return Response.json({
      ...base, property_address: null, seller_info: null, notes: null, special_notes: null,
      documents: deal?.documents?.purchase_contract ? { purchase_contract: deal.documents.purchase_contract } : null
    });
  } catch (error) {
    console.error('[getDealDetails] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});