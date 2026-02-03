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

    // Find associated DealDraft
    const drafts = await base44.asServiceRole.entities.DealDraft.filter({
      legal_agreement_id: agreementData.id
    });

    if (!drafts || drafts.length === 0) {
      console.error('[createDealOnInvestorSignature] No DealDraft found for agreement:', agreementData.id);
      return Response.json({ status: 'error', error: 'no_deal_draft_found' }, { status: 404 });
    }

    const draft = drafts[0];

    console.log('[createDealOnInvestorSignature] Found DealDraft:', draft.id);

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
      selected_agent_ids: draft.selected_agent_ids || [],
      pending_agreement_generation: false
    });

    console.log('[createDealOnInvestorSignature] Created Deal:', newDeal.id);

    // Update the LegalAgreement with the deal_id
    await base44.asServiceRole.entities.LegalAgreement.update(agreementData.id, {
      deal_id: newDeal.id
    });

    console.log('[createDealOnInvestorSignature] Updated LegalAgreement with deal_id');

    // Create invites for selected agents
    await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', {
      deal_id: newDeal.id
    });

    console.log('[createDealOnInvestorSignature] Created agent invites');

    // Delete the DealDraft
    await base44.asServiceRole.entities.DealDraft.delete(draft.id);

    console.log('[createDealOnInvestorSignature] Deleted DealDraft');

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