import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * After investor signs initial agreement, create ONE room with all selected agents.
 * Each agent gets their own DealInvite so they see it in pipeline.
 * Called by createDealOnInvestorSignature after deal is created/found.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { deal_id } = body;
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals?.length) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Load investor profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ id: deal.investor_id });
    if (!profiles?.length) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }
    const investorProfile = profiles[0];
    
    const selectedAgentIds = deal.selected_agent_ids || [];
    console.log('[createInvites] deal:', deal.id, 'agents:', selectedAgentIds);
    
    if (selectedAgentIds.length === 0) {
      return Response.json({ error: 'No agents selected for this deal' }, { status: 400 });
    }
    
    // Build proposed terms from deal - normalize field names
    // CRITICAL: Also check the base agreement's exhibit_a_terms as source of truth
    const rawTerms = deal.proposed_terms || {};
    
    // Load the base agreement to get authoritative exhibit_a_terms
    let exhibitTerms = {};
    const baseAgreementId = deal.current_legal_agreement_id;
    if (baseAgreementId) {
      const agArr = await base44.asServiceRole.entities.LegalAgreement.filter({ id: baseAgreementId });
      if (agArr?.[0]?.exhibit_a_terms) {
        exhibitTerms = agArr[0].exhibit_a_terms;
        console.log('[createInvites] Found exhibit_a_terms from base agreement:', JSON.stringify(exhibitTerms));
      }
    }
    
    // Prefer exhibit_a_terms (agreement is authoritative) over deal.proposed_terms for ALL fields
    const proposedTerms = {
      buyer_commission_type: exhibitTerms.buyer_commission_type || rawTerms.buyer_commission_type || 'percentage',
      buyer_commission_percentage: exhibitTerms.buyer_commission_percentage ?? rawTerms.buyer_commission_percentage ?? null,
      buyer_flat_fee: exhibitTerms.buyer_flat_fee ?? rawTerms.buyer_flat_fee ?? null,
      seller_commission_type: exhibitTerms.seller_commission_type || rawTerms.seller_commission_type || null,
      seller_commission_percentage: exhibitTerms.seller_commission_percentage ?? rawTerms.seller_commission_percentage ?? null,
      seller_flat_fee: exhibitTerms.seller_flat_fee ?? rawTerms.seller_flat_fee ?? null,
      // Normalize: exhibit uses "agreement_length_days", deal stores "agreement_length"
      agreement_length_days: exhibitTerms.agreement_length_days || rawTerms.agreement_length_days || rawTerms.agreement_length || null,
      agreement_length: exhibitTerms.agreement_length_days || rawTerms.agreement_length || rawTerms.agreement_length_days || null,
    };
    console.log('[createInvites] proposedTerms built from deal+agreement:', JSON.stringify(proposedTerms));
    
    // --- ROOM: create or reuse ---
    const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    let room;

    if (existingRooms.length === 0) {
      const agentTerms = {};
      const agentAgreementStatus = {};
      for (const agentId of selectedAgentIds) {
        agentTerms[agentId] = JSON.parse(JSON.stringify(proposedTerms));
        agentAgreementStatus[agentId] = 'sent';
      }

      room = await base44.asServiceRole.entities.Room.create({
        deal_id,
        investorId: investorProfile.id,
        agent_ids: selectedAgentIds,
        agent_terms: agentTerms,
        proposed_terms: JSON.parse(JSON.stringify(proposedTerms)),
        agent_agreement_status: agentAgreementStatus,
        request_status: 'accepted',
        agreement_status: 'investor_signed',
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
      console.log('[createInvites] Created room:', room.id);
      console.log('[createInvites] Created room:', room.id);
    } else {
      room = existingRooms[0];
      // Add any missing agents
      const currentAgentIds = room.agent_ids || [];
      const newAgentIds = selectedAgentIds.filter(id => !currentAgentIds.includes(id));
      if (newAgentIds.length > 0) {
        const updatedTerms = { ...(room.agent_terms || {}) };
        const updatedStatus = { ...(room.agent_agreement_status || {}) };
        for (const agentId of newAgentIds) {
          updatedTerms[agentId] = JSON.parse(JSON.stringify(proposedTerms));
          updatedStatus[agentId] = 'sent';
        }
        await base44.asServiceRole.entities.Room.update(room.id, {
          agent_ids: [...currentAgentIds, ...newAgentIds],
          agent_terms: updatedTerms,
          agent_agreement_status: updatedStatus
        });
      }
      console.log('[createInvites] Reusing room:', room.id);
    }

    // --- FIND BASE AGREEMENT ---
    // The agreement should already exist on the deal (set by createDealOnInvestorSignature)
    const agreementId = deal.current_legal_agreement_id;
    let baseAgreement = null;

    if (agreementId) {
      const agArr = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreementId });
      baseAgreement = agArr?.[0] || null;
    }

    // Fallback: search by deal_id for any investor-signed agreement
    if (!baseAgreement) {
      const allAg = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 10);
      baseAgreement = allAg.find(a => a.investor_signed_at && !a.room_id) || allAg.find(a => a.investor_signed_at) || null;
    }

    if (!baseAgreement) {
      console.error('[createInvites] No investor-signed agreement found for deal:', deal_id);
      return Response.json({ error: 'No investor-signed agreement found' }, { status: 404 });
    }
    console.log('[createInvites] Base agreement:', baseAgreement.id, 'status:', baseAgreement.status);

    // Link room to agreement
    await base44.asServiceRole.entities.Room.update(room.id, {
      current_legal_agreement_id: baseAgreement.id
    });

    // Ensure deal is active and visible — ONLY update status fields
    // ALSO: backfill proposed_terms from exhibit_a_terms if missing on the deal
    const dealStatusUpdate = { status: 'active' };
    if (!deal.pipeline_stage || deal.pipeline_stage === 'draft') {
      dealStatusUpdate.pipeline_stage = 'new_deals';
    }
    const dealHasTerms = deal.proposed_terms && Object.values(deal.proposed_terms).some(v => v !== null && v !== undefined);
    if (!dealHasTerms && Object.keys(exhibitTerms).length > 0) {
      dealStatusUpdate.proposed_terms = proposedTerms;
      console.log('[createInvites] Backfilling deal proposed_terms from exhibit_a_terms');
    }
    await base44.asServiceRole.entities.Deal.update(deal_id, dealStatusUpdate);

    // --- CREATE DEAL INVITES (skip duplicates) ---
    const existingInvites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id });
    const existingAgentIds = new Set(existingInvites.map(i => i.agent_profile_id));

    const createdInvites = [];
    for (const agentId of selectedAgentIds) {
      if (existingAgentIds.has(agentId)) {
        console.log('[createInvites] Invite already exists for agent:', agentId);
        continue;
      }
      const invite = await base44.asServiceRole.entities.DealInvite.create({
        deal_id,
        investor_id: investorProfile.id,
        agent_profile_id: agentId,
        room_id: room.id,
        legal_agreement_id: baseAgreement.id,
        status: 'PENDING_AGENT_SIGNATURE',
        created_at_iso: new Date().toISOString()
      });
      createdInvites.push(invite.id);
      console.log('[createInvites] Created invite:', invite.id, 'for agent:', agentId);
    }

    // --- SCHEDULE WALKTHROUGH: DealAppointments only (chat message is sent by sendNextStepsMessage AFTER the custom message) ---
    const wtScheduled = deal.walkthrough_scheduled === true;
    const wtDate = deal.walkthrough_date || null;
    const wtTime = deal.walkthrough_time || null;
    if (wtScheduled && (wtDate || wtTime)) {
      console.log('[createInvites] Walkthrough scheduled — creating DealAppointments (chat message deferred to sendNextStepsMessage)');
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

    // --- SEND INITIAL MESSAGES (investor next-steps + walkthrough card) ---
    // Send immediately so both parties see them before agent signs
    if (!room.onboarding_message_sent) {
      try {
        // Load agent profile for the template
        const agentId0 = selectedAgentIds[0];
        let agent0 = null;
        if (agentId0) {
          const agProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId0 });
          agent0 = agProfiles?.[0];
        }
        const agentFullName = agent0?.full_name || "";
        const agentFirstName = agentFullName.split(" ")[0] || "there";
        const companyName = investorProfile.company || (investorProfile.investor ? investorProfile.investor.company_name : "") || "";
        const partnerName = companyName.trim() ? companyName.trim() : "me";
        const investorFullName = investorProfile.full_name || "";
        const investorPhone = investorProfile.phone || "";
        const investorEmail = investorProfile.email || "";
        const propertyAddress = deal.property_address || "";

        const customTemplate = 
          (investorProfile.next_steps_template_type === 'custom' && investorProfile.custom_next_steps_template?.trim())
          ? investorProfile.custom_next_steps_template.trim()
          : (investorProfile.next_steps_template?.trim() && investorProfile.next_steps_template !== '' ? investorProfile.next_steps_template.trim() : null);

        let msgBody;
        const walkthroughSection = `Please let me know your availability this week so we can schedule the walkthrough for the property.`;
        if (customTemplate) {
          msgBody = customTemplate
            .replace(/{{PROPERTY_ADDRESS}}/g, propertyAddress)
            .replace(/{{AGENT_FIRST_NAME}}/g, agentFirstName)
            .replace(/{{PARTNER_NAME}}/g, partnerName)
            .replace(/{{INVESTOR_FULL_NAME}}/g, investorFullName)
            .replace(/{{INVESTOR_PHONE_NUMBER}}/g, investorPhone)
            .replace(/{{INVESTOR_EMAIL}}/g, investorEmail)
            .replace(/{{WALKTHROUGH_SECTION}}/g, walkthroughSection);
        } else {
          msgBody = `Next Steps for ${propertyAddress}\n\nHi ${agentFirstName},\n\nThank you for partnering with ${partnerName} on the property at ${propertyAddress}. I'm looking forward to working together.\n\nBelow is a clear outline of the next steps so we're aligned from the start.\n\nStep 1: Initial Walkthrough\n\n${walkthroughSection}\n\nDuring the walkthrough, please:\n\n- Take clear, detailed photos of the entire property (interior and exterior)\n- Make note of any visible defects, damages, or repair items that could impact financing\n- Provide your professional feedback on condition and marketability\n- Prepare and send your CMA (Comparative Market Analysis)\n- Include:\n  - Estimated As-Is Value\n  - Estimated ARV (After Repair Value)\n  - Estimated Rehab Costs\n\nStep 2: Submission & Review\n\nAfter the walkthrough, please upload the following directly to the Deal Room under the Documents tab (or send to ${investorEmail}):\n\n- All photos\n- Your written notes\n- CMA report\n- Estimated As-Is Value\n- Estimated ARV (After Repair Value)\n- Estimated Rehab Costs\n\nOnce reviewed, we'll confirm alignment and move forward with next steps.\n\nLooking forward to working together.\n\nBest,\n${investorFullName}\n${investorPhone}\n${investorEmail}`;
        }

        await base44.asServiceRole.entities.Message.create({
          room_id: room.id,
          sender_profile_id: investorProfile.id,
          body: msgBody,
          read_by: [investorProfile.id],
        });
        console.log('[createInvites] Next-steps message sent for room:', room.id);

        // Send walkthrough card message if scheduled
        const wtSlots2 = (Array.isArray(deal.walkthrough_slots) && deal.walkthrough_slots.length > 0) ? deal.walkthrough_slots : [];
        if (wtScheduled && (wtDate || wtTime || wtSlots2.length > 0)) {
          const displayParts = [wtDate, wtTime].filter(Boolean);
          const displayStr = displayParts.length > 0 ? displayParts.join(' at ') : 'TBD';
          const wtMeta = {
            type: 'walkthrough_request',
            walkthrough_date: wtDate,
            walkthrough_time: wtTime,
            status: 'pending'
          };
          if (wtSlots2.length > 0) wtMeta.walkthrough_slots = wtSlots2;

          await new Promise(r => setTimeout(r, 500));
          await base44.asServiceRole.entities.Message.create({
            room_id: room.id,
            sender_profile_id: investorProfile.id,
            body: `📅 Walk-through Requested\n\nProposed Date & Time: ${displayStr}\n\nPlease confirm or suggest a different time.`,
            metadata: wtMeta,
            read_by: [investorProfile.id],
          });
          console.log('[createInvites] Walkthrough request message sent');
        }

        await base44.asServiceRole.entities.Room.update(room.id, { onboarding_message_sent: true });
        console.log('[createInvites] Marked onboarding_message_sent = true');
      } catch (msgErr) {
        console.warn('[createInvites] Failed to send initial messages (non-fatal):', msgErr.message);
      }
    }

    // --- NOTIFY AGENTS via SMS ---
    for (const agentId of selectedAgentIds) {
      try {
        const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
        const agent = agentProfiles?.[0];
        const textEnabled = agent?.notification_preferences?.text !== false;
        if (textEnabled && agent?.phone) {
          const smsText = `Investor Konnect: New deal invitation for ${deal.title || deal.property_address || 'a property'}. Log in to review and sign to lock in your spot.`;
          await base44.asServiceRole.functions.invoke('sendSms', { to: agent.phone, message: smsText });
          console.log('[createInvites] SMS sent to agent:', agent.email);
        }
      } catch (smsErr) {
        console.warn('[createInvites] Failed to SMS agent:', agentId, smsErr.message);
      }
    }

    return Response.json({ ok: true, room_id: room.id, invite_ids: createdInvites });
    
  } catch (error) {
    console.error('[createInvites] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});