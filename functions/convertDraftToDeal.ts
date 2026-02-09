import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CONVERT DRAFT TO DEAL
 * Called after investor signs agreement
 * Creates real Deal entity, Rooms for each agent, and DealInvites
 * Deletes the DealDraft
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { draft_id } = body;

    if (!draft_id) {
      return Response.json({ error: 'Missing draft_id' }, { status: 400 });
    }

    // Get draft
    const drafts = await base44.asServiceRole.entities.DealDraft.filter({ id: draft_id });
    const draft = drafts[0];
    if (!draft) {
      return Response.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Get investor profile
    const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ 
      id: draft.investor_profile_id 
    });
    const investorProfile = investorProfiles[0];
    if (!investorProfile) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }

    // Get base agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
      deal_id: draft_id 
    });
    const baseAgreement = agreements[0];
    if (!baseAgreement?.investor_signed_at) {
      return Response.json({ error: 'Agreement not signed by investor' }, { status: 400 });
    }

    console.log('[convertDraftToDeal] Converting draft to deal:', draft_id);

    // Create real Deal with proposed_terms
    const deal = await base44.asServiceRole.entities.Deal.create({
      title: `${draft.city}, ${draft.state}`,
      investor_id: investorProfile.id,
      property_address: draft.property_address,
      city: draft.city,
      state: draft.state,
      zip: draft.zip,
      county: draft.county,
      purchase_price: draft.purchase_price,
      property_type: draft.property_type,
      property_details: {
        beds: draft.beds,
        baths: draft.baths,
        sqft: draft.sqft,
        year_built: draft.year_built,
        number_of_stories: draft.number_of_stories,
        has_basement: draft.has_basement
      },
      seller_info: {
        seller_name: draft.seller_name,
        earnest_money: draft.earnest_money,
        number_of_signers: draft.number_of_signers,
        second_signer_name: draft.second_signer_name
      },
      proposed_terms: {
        seller_commission_type: draft.seller_commission_type,
        seller_commission_percentage: draft.seller_commission_percentage,
        seller_flat_fee: draft.seller_flat_fee,
        buyer_commission_type: draft.buyer_commission_type,
        buyer_commission_percentage: draft.buyer_commission_percentage,
        buyer_flat_fee: draft.buyer_flat_fee,
        agreement_length: draft.agreement_length
      },
      key_dates: {
        closing_date: draft.closing_date,
        contract_date: draft.contract_date
      },
      contract_url: draft.contract_url,
      special_notes: draft.special_notes,
      selected_agent_ids: draft.selected_agent_ids,
      status: 'active',
      pipeline_stage: 'new_deals',
      walkthrough_scheduled: draft.walkthrough_scheduled === true ? true : false,
      walkthrough_datetime: draft.walkthrough_datetime || null
    });

    console.log('[convertDraftToDeal] Created deal:', deal.id);

    // Update base agreement to point to real deal
    await base44.asServiceRole.entities.LegalAgreement.update(baseAgreement.id, {
      deal_id: deal.id
    });

    // Create Rooms and DealInvites for each agent
    const selectedAgentIds = draft.selected_agent_ids || [];
    const roomIds = [];
    const inviteIds = [];

    for (const agentProfileId of selectedAgentIds) {
      // Get agent profile
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ 
        id: agentProfileId 
      });
      const agentProfile = agentProfiles[0];
      if (!agentProfile) {
        console.warn('[convertDraftToDeal] Agent profile not found:', agentProfileId);
        continue;
      }

      // Create Room with proposed_terms
      const room = await base44.asServiceRole.entities.Room.create({
        deal_id: deal.id,
        investorId: investorProfile.id,
        agent_ids: [agentProfileId],
        request_status: 'requested',
        agreement_status: 'draft',
        title: deal.title,
        property_address: draft.property_address,
        city: draft.city,
        state: draft.state,
        county: draft.county,
        zip: draft.zip,
        budget: draft.purchase_price,
        closing_date: draft.closing_date,
        requested_at: new Date().toISOString(),
        agent_terms: {
          [agentProfileId]: {
            buyer_commission_type: draft.buyer_commission_type,
            buyer_commission_percentage: draft.buyer_commission_percentage,
            buyer_flat_fee: draft.buyer_flat_fee
          }
        }
      });

      roomIds.push(room.id);
      console.log('[convertDraftToDeal] Created room:', room.id);

      // Create DealInvite
      const invite = await base44.asServiceRole.entities.DealInvite.create({
        deal_id: deal.id,
        investor_id: investorProfile.id,
        agent_profile_id: agentProfileId,
        room_id: room.id,
        legal_agreement_id: baseAgreement.id,
        status: 'PENDING_AGENT_SIGNATURE',
        created_at_iso: new Date().toISOString()
      });

      inviteIds.push(invite.id);
      console.log('[convertDraftToDeal] Created invite:', invite.id);
    }

    // Delete draft
    await base44.asServiceRole.entities.DealDraft.delete(draft_id);
    console.log('[convertDraftToDeal] Deleted draft:', draft_id);

    return Response.json({
      success: true,
      deal_id: deal.id,
      room_ids: roomIds,
      invite_ids: inviteIds
    });
  } catch (error) {
    console.error('[convertDraftToDeal] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});