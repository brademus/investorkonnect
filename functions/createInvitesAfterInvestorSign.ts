import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
  * After investor signs initial agreement, create ONE room with all selected agents
  * Each agent gets their own terms copy in agent_terms
  */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { deal_id } = body;
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Get deal first (use service role as this might be called from automation)
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found', status: 404 }, { status: 404 });
    }
    const deal = deals[0];
    
    // Get investor profile using deal's investor_id
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: deal.investor_id });
    if (!profiles || profiles.length === 0) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }
    const profile = profiles[0];
    
    let selectedAgentIds = deal.selected_agent_ids || [];
    console.log('[createInvitesAfterInvestorSign] Deal:', { 
      id: deal.id, 
      selected_agent_ids: selectedAgentIds,
      agent_id: deal.agent_id 
    });
    
    if (selectedAgentIds.length === 0) {
      console.error('[createInvitesAfterInvestorSign] No agents selected on deal');
      return Response.json({ error: 'No agents selected for this deal' }, { status: 400 });
    }
    
    // Ensure proposed_terms has buyer commission (set defaults if needed)
    const proposedTerms = deal.proposed_terms || {};
    if (!proposedTerms.buyer_commission_type) {
      proposedTerms.buyer_commission_type = 'percentage';
      proposedTerms.buyer_commission_percentage = 0;
    }
    
    // Check if room already exists for this deal
    const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    
    let roomToUse;
    if (existingRooms.length === 0) {
      // Create ONE room for all agents - each agent gets same initial terms
      const agent_terms = {};
      for (const agentId of selectedAgentIds) {
        agent_terms[agentId] = JSON.parse(JSON.stringify(proposedTerms));
      }

      roomToUse = await base44.asServiceRole.entities.Room.create({
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
      console.log('[createInvitesAfterInvestorSign] Created new Room:', roomToUse.id);
    } else {
      // Update existing room to add any new agents
      roomToUse = existingRooms[0];
      const currentAgentIds = roomToUse.agent_ids || [];
      const newAgentIds = selectedAgentIds.filter(id => !currentAgentIds.includes(id));

      if (newAgentIds.length > 0) {
         const updatedAgentTerms = roomToUse.agent_terms || {};
         for (const agentId of newAgentIds) {
           updatedAgentTerms[agentId] = JSON.parse(JSON.stringify(proposedTerms));
         }

         await base44.asServiceRole.entities.Room.update(roomToUse.id, {
           agent_ids: [...currentAgentIds, ...newAgentIds],
           agent_terms: updatedAgentTerms,
           agent_agreement_status: {
             ...roomToUse.agent_agreement_status,
             ...newAgentIds.reduce((acc, id) => ({ ...acc, [id]: 'sent' }), {})
           }
         });
         console.log('[createInvitesAfterInvestorSign] Updated existing Room:', roomToUse.id);
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
    await base44.asServiceRole.entities.Room.update(roomToUse.id, {
      current_legal_agreement_id: baseAgreement.id
    });

    // Update deal
    await base44.asServiceRole.entities.Deal.update(deal_id, {
      status: 'active',
      pipeline_stage: 'new_deals'
    });

    // Create DealInvite records for each agent (so they see it in their inbox)
    const createdInvites = [];
    for (const agentId of selectedAgentIds) {
      const invite = await base44.asServiceRole.entities.DealInvite.create({
        deal_id: deal_id,
        investor_id: profile.id,
        agent_profile_id: agentId,
        room_id: roomToUse.id,
        legal_agreement_id: baseAgreement.id,
        status: 'PENDING_AGENT_SIGNATURE',
        created_at_iso: new Date().toISOString()
      });
      createdInvites.push(invite.id);
      console.log('[createInvitesAfterInvestorSign] Created DealInvite:', invite.id, 'for agent:', agentId);
    }

    console.log('[createInvitesAfterInvestorSign] Success - created room:', roomToUse.id, 'and', createdInvites.length, 'invites for deal:', deal_id);
    return Response.json({ ok: true, room_id: roomToUse.id, invite_ids: createdInvites });
    
  } catch (error) {
    console.error('[createInvitesAfterInvestorSign] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});