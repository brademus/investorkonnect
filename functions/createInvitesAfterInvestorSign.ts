import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
  * After investor signs initial agreement, create ONE room with all selected agents
  * Each agent gets their own terms copy in agent_terms
  */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const { deal_id } = body;
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Verify authorization
    const isAdmin = user.role === 'admin' || profile.role === 'admin';
    if (deal.investor_id !== profile.id && !isAdmin) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    let selectedAgentIds = deal.selected_agent_ids || [];
    if (selectedAgentIds.length === 0) {
      return Response.json({ error: 'No agents selected' }, { status: 400 });
    }
    
    // Ensure proposed_terms has buyer commission (CRITICAL)
    const proposedTerms = deal.proposed_terms || {};
    if (!proposedTerms.buyer_commission_type) {
      return Response.json({ error: 'Missing buyer commission terms in deal' }, { status: 400 });
    }
    
    // Check if room already exists for this deal
    const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    
    if (existingRooms.length === 0) {
      // Create ONE room for all agents - each agent gets same initial terms
      const agent_terms = {};
      for (const agentId of selectedAgentIds) {
        agent_terms[agentId] = JSON.parse(JSON.stringify(proposedTerms));
      }
      
      await base44.asServiceRole.entities.Room.create({
        deal_id: deal_id,
        investorId: profile.id,
        agent_ids: selectedAgentIds,
        agent_terms: agent_terms,
        agent_agreement_status: selectedAgentIds.reduce((acc, id) => ({ ...acc, [id]: 'sent' }), {}),
        request_status: 'accepted',
        agreement_status: 'sent',
        title: deal.title,
        property_address: deal.property_address,
        city: deal.city,
        state: deal.state,
        county: deal.county,
        zip: deal.zip,
        budget: deal.purchase_price,
        closing_date: deal.key_dates?.closing_date,
        requested_at: new Date().toISOString(),
        accepted_at: new Date().toISOString()
      });
    } else {
      // Update existing room to add any new agents
      const room = existingRooms[0];
      const currentAgentIds = room.agent_ids || [];
      const newAgentIds = selectedAgentIds.filter(id => !currentAgentIds.includes(id));
      
      if (newAgentIds.length > 0) {
        const updatedAgentTerms = room.agent_terms || {};
        for (const agentId of newAgentIds) {
          updatedAgentTerms[agentId] = deal.proposed_terms ? JSON.parse(JSON.stringify(deal.proposed_terms)) : {};
        }
        
        await base44.asServiceRole.entities.Room.update(room.id, {
          agent_ids: [...currentAgentIds, ...newAgentIds],
          agent_terms: updatedAgentTerms,
          agent_agreement_status: {
            ...room.agent_agreement_status,
            ...newAgentIds.reduce((acc, id) => ({ ...acc, [id]: 'sent' }), {})
          }
        });
      }
    }
    
    // Get base investor-signed agreement
    const baseAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
      deal_id: deal_id,
      room_id: null,
      status: 'investor_signed'
    }, '-created_date', 1);
    
    const baseAgreement = baseAgreements?.[0];
    if (!baseAgreement) {
      throw new Error('Base agreement not found');
    }
    
    // Update room to point to agreement
    const room = existingRooms[0] || (await base44.asServiceRole.entities.Room.filter({ deal_id }))[0];
    await base44.asServiceRole.entities.Room.update(room.id, {
      current_legal_agreement_id: baseAgreement.id
    });
    
    // Update deal
    await base44.asServiceRole.entities.Deal.update(deal_id, {
      status: 'active',
      pipeline_stage: 'new_deals'
    });

    return Response.json({ ok: true, room_id: room.id });
    
  } catch (error) {
    console.error('[createInvitesAfterInvestorSign] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});