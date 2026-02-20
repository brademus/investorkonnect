import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    if (!payload) return Response.json({ error: 'Missing payload' }, { status: 400 });

    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 400 });

    // Create DealDraft with walkthrough slots preserved
    const draft = await base44.entities.DealDraft.create({
      investor_profile_id: profile.id,
      property_address: payload.propertyAddress,
      city: payload.city,
      state: payload.state,
      zip: payload.zip,
      county: payload.county,
      purchase_price: payload.purchasePrice,
      closing_date: payload.closingDate,
      contract_date: payload.contractDate,
      property_type: payload.propertyType,
      deal_type: payload.dealType,
      beds: payload.beds,
      baths: payload.baths,
      sqft: payload.sqft,
      year_built: payload.yearBuilt,
      number_of_stories: payload.numberOfStories,
      has_basement: payload.hasBasement,
      seller_name: payload.sellerName,
      earnest_money: payload.earnestMoney,
      number_of_signers: payload.numberOfSigners,
      second_signer_name: payload.secondSignerName,
      seller_commission_type: payload.sellerCommissionType,
      seller_commission_percentage: payload.sellerCommissionPercentage,
      seller_flat_fee: payload.sellerFlatFee,
      buyer_commission_type: payload.buyerCommissionType,
      buyer_commission_percentage: payload.buyerCommissionPercentage,
      buyer_flat_fee: payload.buyerFlatFee,
      agreement_length: payload.agreementLength,
      contract_url: payload.contractUrl,
      special_notes: payload.specialNotes,
      selected_agent_ids: payload.selectedAgentIds || [],
      walkthrough_slots: payload.walkthroughSlots || []
    });

    return Response.json({ draft_id: draft.id });
  } catch (error) {
    console.error('[saveDealAndCreateDraft]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});