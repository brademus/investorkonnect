import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * After investor signs initial agreement, create ONE DEAL PER AGENT.
 * Each agent gets their own Deal, Room, and DealInvite — fully isolated.
 * Counter offers on one deal never affect another agent's deal.
 * 
 * Expects: { deal_id } — the "template" deal created from the DealDraft.
 * This template deal becomes the first agent's deal; additional agents get clones.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { deal_id } = body;
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Load the template deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals?.length) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const templateDeal = deals[0];
    
    // Load investor profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: templateDeal.investor_id });
    if (!profiles?.length) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }
    const investorProfile = profiles[0];
    
    const selectedAgentIds = templateDeal.selected_agent_ids || [];
    console.log('[createInvites] deal:', templateDeal.id, 'agents:', selectedAgentIds);
    
    if (selectedAgentIds.length === 0) {
      return Response.json({ error: 'No agents selected for this deal' }, { status: 400 });
    }
    
    // Build proposed terms from deal - normalize field names
    // Load the base agreement to get authoritative exhibit_a_terms
    const rawTerms = templateDeal.proposed_terms || {};
    let exhibitTerms = {};
    const baseAgreementId = templateDeal.current_legal_agreement_id;
    if (baseAgreementId) {
      const agArr = await base44.asServiceRole.entities.LegalAgreement.filter({ id: baseAgreementId });
      if (agArr?.[0]?.exhibit_a_terms) {
        exhibitTerms = agArr[0].exhibit_a_terms;
        console.log('[createInvites] Found exhibit_a_terms from base agreement:', JSON.stringify(exhibitTerms));
      }
    }
    
    // Prefer exhibit_a_terms (agreement is authoritative) over deal.proposed_terms
    const proposedTerms = {
      buyer_commission_type: exhibitTerms.buyer_commission_type || rawTerms.buyer_commission_type || 'percentage',
      buyer_commission_percentage: exhibitTerms.buyer_commission_percentage ?? rawTerms.buyer_commission_percentage ?? null,
      buyer_flat_fee: exhibitTerms.buyer_flat_fee ?? rawTerms.buyer_flat_fee ?? null,
      seller_commission_type: exhibitTerms.seller_commission_type || rawTerms.seller_commission_type || null,
      seller_commission_percentage: exhibitTerms.seller_commission_percentage ?? rawTerms.seller_commission_percentage ?? null,
      seller_flat_fee: exhibitTerms.seller_flat_fee ?? rawTerms.seller_flat_fee ?? null,
      agreement_length_days: exhibitTerms.agreement_length_days || rawTerms.agreement_length_days || rawTerms.agreement_length || null,
      agreement_length: exhibitTerms.agreement_length_days || rawTerms.agreement_length || rawTerms.agreement_length_days || null,
    };
    console.log('[createInvites] proposedTerms built from deal+agreement:', JSON.stringify(proposedTerms));

    // Check for existing invites to avoid duplicates
    const existingInvites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id: deal_id });
    const existingAgentIds = new Set(existingInvites.map(i => i.agent_profile_id));

    // Track created entities
    const createdDeals = [];
    const createdInvites = [];
    const createdRooms = [];
    
    // --- CREATE ONE DEAL + ROOM + INVITE PER AGENT ---
    for (let idx = 0; idx < selectedAgentIds.length; idx++) {
      const agentId = selectedAgentIds[idx];
      
      // Skip if invite already exists for this agent on this deal or any sibling deal
      if (existingAgentIds.has(agentId)) {
        console.log('[createInvites] Invite already exists for agent:', agentId);
        continue;
      }
      
      // Check if a sibling deal already exists for this agent + same property
      const existingSiblings = await base44.asServiceRole.entities.DealInvite.filter({ 
        agent_profile_id: agentId 
      });
      const siblingForSameProperty = existingSiblings.find(inv => {
        // Check if this invite's deal is a sibling (same source or same template)
        return inv.deal_id === deal_id || 
               (templateDeal.source_deal_id && inv.deal_id === templateDeal.source_deal_id);
      });
      if (siblingForSameProperty) {
        console.log('[createInvites] Agent', agentId, 'already has invite for sibling deal, skipping');
        continue;
      }
      
      let agentDeal;
      
      if (idx === 0) {
        // First agent: use the template deal directly (already created)
        agentDeal = templateDeal;
        // Set agent_id on the template deal
        await base44.asServiceRole.entities.Deal.update(templateDeal.id, {
          agent_id: agentId,
          selected_agent_ids: [agentId]
        });
        console.log('[createInvites] First agent', agentId, 'assigned to template deal:', templateDeal.id);
      } else {
        // Subsequent agents: clone the template deal
        agentDeal = await base44.asServiceRole.entities.Deal.create({
          title: templateDeal.title,
          description: templateDeal.description || "",
          property_address: templateDeal.property_address,
          city: templateDeal.city,
          state: templateDeal.state,
          zip: templateDeal.zip,
          county: templateDeal.county,
          purchase_price: templateDeal.purchase_price,
          estimated_list_price: templateDeal.estimated_list_price || null,
          key_dates: templateDeal.key_dates || {},
          property_type: templateDeal.property_type || null,
          property_details: templateDeal.property_details || {},
          seller_info: templateDeal.seller_info || {},
          proposed_terms: JSON.parse(JSON.stringify(proposedTerms)),
          contract_document: templateDeal.contract_document || null,
          status: "active",
          pipeline_stage: "new_deals",
          investor_id: templateDeal.investor_id,
          agent_id: agentId,
          selected_agent_ids: [agentId],
          source_deal_id: templateDeal.id,
          current_legal_agreement_id: templateDeal.current_legal_agreement_id,
          pending_agreement_generation: false,
          walkthrough_scheduled: templateDeal.walkthrough_scheduled || false,
          walkthrough_date: templateDeal.walkthrough_date || null,
          walkthrough_time: templateDeal.walkthrough_time || null,
          walkthrough_slots: templateDeal.walkthrough_slots || [],
          deal_type: templateDeal.deal_type || null
        });
        console.log('[createInvites] Cloned deal for agent', agentId, ':', agentDeal.id);
        createdDeals.push(agentDeal.id);
        
        // Create DealAppointments for cloned deal if walkthrough was scheduled
        if (templateDeal.walkthrough_scheduled && (templateDeal.walkthrough_date || templateDeal.walkthrough_time || (templateDeal.walkthrough_slots?.length > 0))) {
          try {
            await base44.asServiceRole.entities.DealAppointments.create({
              dealId: agentDeal.id,
              walkthrough: {
                status: 'PROPOSED',
                datetime: null,
                timezone: null,
                locationType: 'ON_SITE',
                notes: null,
                updatedByUserId: investorProfile.id,
                updatedAt: new Date().toISOString()
              },
              inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
              rescheduleRequests: []
            });
          } catch (apptErr) {
            console.warn('[createInvites] Failed to create DealAppointments for clone:', apptErr.message);
          }
        }
      }
      
      // Create Room for this agent's deal (one room per deal, one agent per room)
      const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: agentDeal.id });
      let room;
      
      if (existingRooms.length === 0) {
        room = await base44.asServiceRole.entities.Room.create({
          deal_id: agentDeal.id,
          investorId: investorProfile.id,
          agent_ids: [agentId],
          agent_terms: { [agentId]: JSON.parse(JSON.stringify(proposedTerms)) },
          proposed_terms: JSON.parse(JSON.stringify(proposedTerms)),
          agent_agreement_status: { [agentId]: 'sent' },
          request_status: 'accepted',
          agreement_status: 'investor_signed',
          current_legal_agreement_id: agentDeal.current_legal_agreement_id,
          title: agentDeal.title,
          property_address: agentDeal.property_address,
          city: agentDeal.city,
          state: agentDeal.state,
          county: agentDeal.county,
          zip: agentDeal.zip,
          budget: agentDeal.purchase_price,
          closing_date: agentDeal.key_dates?.closing_date,
          requested_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        });
        console.log('[createInvites] Created room for agent', agentId, ':', room.id);
        createdRooms.push(room.id);
      } else {
        room = existingRooms[0];
        console.log('[createInvites] Reusing existing room for agent', agentId, ':', room.id);
      }
      
      // Create DealInvite for this agent
      const invite = await base44.asServiceRole.entities.DealInvite.create({
        deal_id: agentDeal.id,
        investor_id: investorProfile.id,
        agent_profile_id: agentId,
        room_id: room.id,
        legal_agreement_id: agentDeal.current_legal_agreement_id,
        status: 'PENDING_AGENT_SIGNATURE',
        created_at_iso: new Date().toISOString()
      });
      createdInvites.push(invite.id);
      console.log('[createInvites] Created invite:', invite.id, 'for agent:', agentId, 'deal:', agentDeal.id);
    }

    // --- SCHEDULE WALKTHROUGH for template deal ---
    const wtScheduled = templateDeal.walkthrough_scheduled === true;
    const wtDate = templateDeal.walkthrough_date || null;
    const wtTime = templateDeal.walkthrough_time || null;
    if (wtScheduled && (wtDate || wtTime)) {
      try {
        const apptRows = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: deal_id });
        const apptPatch = {
          walkthrough: {
            status: 'PROPOSED',
            datetime: null,
            timezone: null,
            locationType: 'ON_SITE',
            notes: null,
            updatedByUserId: investorProfile.id,
            updatedAt: new Date().toISOString()
          }
        };
        if (apptRows?.[0]) {
          await base44.asServiceRole.entities.DealAppointments.update(apptRows[0].id, apptPatch);
        } else {
          await base44.asServiceRole.entities.DealAppointments.create({
            dealId: deal_id,
            ...apptPatch,
            inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
            rescheduleRequests: []
          });
        }
        console.log('[createInvites] Created DealAppointments for walkthrough');
      } catch (wtErr) {
        console.warn('[createInvites] Failed to create DealAppointments (non-fatal):', wtErr.message);
      }
    }

    // Ensure template deal is active
    const dealStatusUpdate = { status: 'active' };
    if (!templateDeal.pipeline_stage || templateDeal.pipeline_stage === 'draft') {
      dealStatusUpdate.pipeline_stage = 'new_deals';
    }
    const dealHasTerms = templateDeal.proposed_terms && Object.values(templateDeal.proposed_terms).some(v => v !== null && v !== undefined);
    if (!dealHasTerms && Object.keys(exhibitTerms).length > 0) {
      dealStatusUpdate.proposed_terms = proposedTerms;
    }
    await base44.asServiceRole.entities.Deal.update(deal_id, dealStatusUpdate);

    // --- NOTIFY AGENTS via EMAIL + SMS ---
    for (const agentId of selectedAgentIds) {
      try {
        const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
        const agent = agentProfiles?.[0];
        if (!agent) continue;

        const notifBody = `Hi ${agent.full_name?.split(' ')[0] || 'there'}, you have received a new deal. Log in to review and sign.`;

        if (agent.email && agent.notification_preferences?.email !== false) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: agent.email,
            subject: `You have received a new deal`,
            body: notifBody,
          }).catch(emailErr => {
            console.warn('[createInvites] Failed to email agent:', agentId, emailErr.message);
          });
        }

        const textEnabled = agent.notification_preferences?.text !== false;
        if (textEnabled && agent.phone) {
          await base44.asServiceRole.functions.invoke('sendSms', { to: agent.phone, message: notifBody });
        }
      } catch (notifyErr) {
        console.warn('[createInvites] Failed to notify agent:', agentId, notifyErr.message);
      }
    }

    return Response.json({ 
      ok: true, 
      template_deal_id: deal_id,
      created_deals: createdDeals,
      created_rooms: createdRooms,
      invite_ids: createdInvites 
    });
    
  } catch (error) {
    console.error('[createInvites] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});