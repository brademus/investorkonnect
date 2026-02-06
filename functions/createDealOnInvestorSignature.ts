import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    console.log('[createDealOnInvestorSignature] Received event:', JSON.stringify(body, null, 2));

    const { event, data: agreementData, old_data: oldAgreementData } = body;

    // Only process update events where investor just signed
    if (event?.type !== 'update') {
      return Response.json({ status: 'ignored', reason: 'not_update_event' });
    }

    // Check if investor_signed_at was just set (wasn't set before, is set now)
    const wasNotSigned = !oldAgreementData?.investor_signed_at;
    const isNowSigned = !!agreementData?.investor_signed_at;

    if (!(wasNotSigned && isNowSigned)) {
      return Response.json({ status: 'ignored', reason: 'not_new_investor_signature' });
    }

    // Only process base agreements (no room_id)
    if (agreementData?.room_id) {
      return Response.json({ status: 'ignored', reason: 'room_scoped_agreement' });
    }

    console.log('[createDealOnInvestorSignature] Investor just signed base agreement:', agreementData.id);

    // Check if a REAL Deal entity already exists (not a DealDraft)
    // The agreement's deal_id might point to a DealDraft ID in the new flow
    let existingDeal = null;
    
    // Check by current_legal_agreement_id first (most reliable)
    const dealsByAgreement = await base44.asServiceRole.entities.Deal.filter({
      current_legal_agreement_id: agreementData.id
    });
    existingDeal = dealsByAgreement?.[0] || null;
    
    // Also try by deal_id if it's a real Deal (not a DealDraft)
    if (!existingDeal && agreementData.deal_id) {
      try {
        const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreementData.deal_id });
        if (deals && deals.length > 0) {
          existingDeal = deals[0];
        }
      } catch (e) {
        // deal_id might be a DealDraft ID, not a Deal - that's expected
        console.log('[createDealOnInvestorSignature] deal_id is not a Deal entity (likely DealDraft):', agreementData.deal_id);
      }
    }

    if (existingDeal) {
      console.log('[createDealOnInvestorSignature] Deal already exists:', existingDeal.id, '- creating invites');
      
      // Deal was created previously - just create invites
      try {
        await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', {
          deal_id: existingDeal.id
        });
        console.log('[createDealOnInvestorSignature] Created agent invites');
      } catch (e) {
        console.error('[createDealOnInvestorSignature] Failed to create invites:', e.message);
      }

      return Response.json({
        status: 'success',
        deal_id: existingDeal.id,
        reason: 'invites_created_for_existing_deal'
      });
    }

    // Fallback: Try to find DealDraft by agreement's deal_id (which is the draft ID) OR by investor_profile_id
    const investorId = agreementData.investor_profile_id;
    const agreementDealId = agreementData.deal_id;
    console.log('[createDealOnInvestorSignature] Looking for DealDraft:', { agreementDealId, investorId });

    let drafts = [];
    
    // First try by ID (most reliable - agreement.deal_id points to DealDraft.id in new flow)
    if (agreementDealId) {
      const draftById = await base44.asServiceRole.entities.DealDraft.filter({ id: agreementDealId });
      if (draftById && draftById.length > 0) {
        drafts = draftById;
        console.log('[createDealOnInvestorSignature] Found DealDraft by ID:', agreementDealId);
      }
    }
    
    // Fallback: by investor_profile_id (legacy flow)
    if (drafts.length === 0 && investorId) {
      drafts = await base44.asServiceRole.entities.DealDraft.filter({
        investor_profile_id: investorId
      });
      // Filter by most recent created
      if (drafts && drafts.length > 0) {
        drafts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        drafts = [drafts[0]]; // Take most recent
        console.log('[createDealOnInvestorSignature] Found DealDraft by investor:', drafts[0].id);
      }
    }

    if (!drafts || drafts.length === 0) {
      console.error('[createDealOnInvestorSignature] No DealDraft found for investor:', investorId);
      return Response.json({ 
        status: 'error', 
        error: 'no_deal_draft_found',
        reason: 'Could not find DealDraft for this investor'
      }, { status: 404 });
    }

    const draft = drafts[0];
    const selectedAgents = draft.selected_agent_ids || [];
    console.log('[createDealOnInvestorSignature] Found DealDraft:', draft.id, 'with selected_agent_ids:', selectedAgents);

    // Validate that we have agents
    if (!selectedAgents || selectedAgents.length === 0) {
      console.error('[createDealOnInvestorSignature] DealDraft has no selected agents!');
      return Response.json({ 
        status: 'error', 
        error: 'no_agents_selected',
        reason: 'DealDraft has no selected_agent_ids'
      }, { status: 400 });
    }

    // Create the Deal entity
    const newDeal = await base44.asServiceRole.entities.Deal.create({
      title: draft.property_address,
      description: draft.special_notes || "",
      property_address: draft.property_address,
      city: draft.city,
      state: draft.state,
      zip: draft.zip,
      county: draft.county,
      purchase_price: draft.purchase_price,
      key_dates: {
        closing_date: draft.closing_date,
        contract_date: draft.contract_date,
      },
      property_type: draft.property_type || null,
      property_details: {
        beds: draft.beds || null,
        baths: draft.baths || null,
        sqft: draft.sqft || null,
        year_built: draft.year_built || null,
        number_of_stories: draft.number_of_stories || null,
        has_basement: draft.has_basement || null,
      },
      seller_info: {
        seller_name: draft.seller_name,
        earnest_money: draft.earnest_money || null,
        number_of_signers: draft.number_of_signers,
        second_signer_name: draft.second_signer_name,
      },
      proposed_terms: {
        seller_commission_type: draft.seller_commission_type,
        seller_commission_percentage: draft.seller_commission_percentage || null,
        seller_flat_fee: draft.seller_flat_fee || null,
        buyer_commission_type: draft.buyer_commission_type,
        buyer_commission_percentage: draft.buyer_commission_percentage || null,
        buyer_flat_fee: draft.buyer_flat_fee || null,
        agreement_length: draft.agreement_length || null,
      },
      contract_document: draft.contract_url ? {
        url: draft.contract_url,
        name: "contract.pdf",
        uploaded_at: new Date().toISOString()
      } : null,
      status: "active",
      pipeline_stage: "new_deals",
      investor_id: draft.investor_profile_id,
      selected_agent_ids: selectedAgents,
      pending_agreement_generation: false,
      current_legal_agreement_id: agreementData.id
    });
    
    console.log('[createDealOnInvestorSignature] Created Deal:', newDeal.id, 'with selected_agent_ids:', newDeal.selected_agent_ids);

    // Update the LegalAgreement with the NEW deal_id
    await base44.asServiceRole.entities.LegalAgreement.update(agreementData.id, {
      deal_id: newDeal.id,
      status: 'investor_signed' // Ensure status is correct
    });

    console.log('[createDealOnInvestorSignature] Updated LegalAgreement with deal_id:', newDeal.id);

    // Delete the DealDraft AFTER everything is set up
    try {
      await base44.asServiceRole.entities.DealDraft.delete(draft.id);
      console.log('[createDealOnInvestorSignature] Deleted DealDraft:', draft.id);
    } catch (delErr) {
      console.warn('[createDealOnInvestorSignature] Failed to delete DealDraft (non-fatal):', delErr.message);
    }

    // Create invites for selected agents - pass the new deal ID
    // Use try/catch so Deal creation is not rolled back if invite creation fails
    try {
      await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', {
        deal_id: newDeal.id
      });
      console.log('[createDealOnInvestorSignature] Created agent invites');
    } catch (inviteErr) {
      console.error('[createDealOnInvestorSignature] Failed to create invites (Deal still created):', inviteErr.message);
    }

    return Response.json({
      status: 'success',
      deal_id: newDeal.id,
      draft_id: draft.id
    });

  } catch (error) {
    console.error('[createDealOnInvestorSignature] Error:', error);
    return Response.json({ 
      status: 'error', 
      error: error.message 
    }, { status: 500 });
  }
});