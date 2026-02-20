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

    // Link room to agreement (both directions)
    await base44.asServiceRole.entities.Room.update(room.id, {
      current_legal_agreement_id: baseAgreement.id
    });

    // CRITICAL: Also link agreement back to room so Room-page subscriptions can find it
    if (!baseAgreement.room_id || baseAgreement.room_id !== room.id) {
      await base44.asServiceRole.entities.LegalAgreement.update(baseAgreement.id, {
        room_id: room.id
      });
      console.log('[createInvites] Linked agreement', baseAgreement.id, 'to room', room.id);
    }

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

    // --- SEND WALKTHROUGH MESSAGE if investor set slots ---
    const wtSlots = (Array.isArray(deal.walkthrough_slots) ? deal.walkthrough_slots : []).filter(s => s.date && s.date.length >= 8);
    if (wtSlots.length > 0) {
      console.log('[createInvites] Walkthrough has', wtSlots.length, 'slots — sending chat message');
      try {
        // Check if a walkthrough_request message already exists
        const existingMessages = await base44.asServiceRole.entities.Message.filter({ room_id: room.id }, '-created_date', 50);
        const alreadyHasWtMessage = existingMessages.some(m => m?.metadata?.type === 'walkthrough_request');

        if (!alreadyHasWtMessage) {
          const displayStr = wtSlots.map((s, i) => {
            let text = s.date;
            if (s.timeStart) text += ` ${s.timeStart}`;
            if (s.timeEnd) text += ` – ${s.timeEnd}`;
            return `Option ${i + 1}: ${text}`;
          }).join('\n');

          await base44.asServiceRole.entities.Message.create({
            room_id: room.id,
            sender_profile_id: investorProfile.id,
            body: `📅 Walk-through Requested\n\n${displayStr}\n\nPlease confirm or suggest a different time after signing.`,
            metadata: {
              type: 'walkthrough_request',
              walkthrough_slots: wtSlots,
              status: 'pending'
            }
          });
          console.log('[createInvites] Sent walkthrough message to room:', room.id);
        } else {
          console.log('[createInvites] Walkthrough message already exists — skipping duplicate');
        }
      } catch (wtErr) {
        console.warn('[createInvites] Failed to send walkthrough message (non-fatal):', wtErr.message);
      }
    }

    // --- NOTIFY AGENTS via email --- (DISABLED for now)
    // for (const agentId of selectedAgentIds) {
    //   try {
    //     const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
    //     const agent = agentProfiles?.[0];
    //     if (agent?.email) {
    //       const wtNote = (wtScheduled && (wtDate || wtTime)) ? `\n\nA walk-through has been proposed — you can confirm or decline after signing.\n` : '';
    //       await base44.asServiceRole.integrations.Core.SendEmail({
    //         to: agent.email,
    //         subject: `New Deal Invitation - ${deal.title || deal.property_address || 'New Deal'}`,
    //         body: `Hello ${agent.full_name || 'Agent'},\n\nYou have been invited to a new deal: ${deal.title || deal.property_address}.\n\nThe investor has signed the agreement. Please log in to review the deal and sign the agreement to lock in your spot.${wtNote}\nNote: The first agent to sign will be selected for this deal.\n\nBest regards,\nInvestor Konnect Team`
    //       });
    //       console.log('[createInvites] Notified agent:', agent.email);
    //     }
    //   } catch (emailErr) {
    //     console.warn('[createInvites] Failed to email agent:', agentId, emailErr.message);
    //   }
    // }
    console.log('[createInvites] Agent email notifications are disabled');

    return Response.json({ ok: true, room_id: room.id, invite_ids: createdInvites });
    
  } catch (error) {
    console.error('[createInvites] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});