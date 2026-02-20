import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payload } = await req.json();
    if (!payload) return Response.json({ error: 'Missing payload' }, { status: 400 });

    // Create DealDraft with all deal info + walkthrough slots
    const draft = await base44.entities.DealDraft.create({
      investor_profile_id: payload.investor_profile_id,
      property_address: payload.property_address,
      city: payload.city,
      state: payload.state,
      zip: payload.zip,
      county: payload.county,
      purchase_price: payload.purchase_price,
      closing_date: payload.closing_date,
      contract_date: payload.contract_date,
      property_type: payload.property_type,
      deal_type: payload.deal_type,
      beds: payload.beds,
      baths: payload.baths,
      sqft: payload.sqft,
      year_built: payload.year_built,
      number_of_stories: payload.number_of_stories,
      has_basement: payload.has_basement,
      seller_name: payload.seller_name,
      earnest_money: payload.earnest_money,
      number_of_signers: payload.number_of_signers,
      second_signer_name: payload.second_signer_name,
      seller_commission_type: payload.seller_commission_type,
      seller_commission_percentage: payload.seller_commission_percentage,
      seller_flat_fee: payload.seller_flat_fee,
      buyer_commission_type: payload.buyer_commission_type,
      buyer_commission_percentage: payload.buyer_commission_percentage,
      buyer_flat_fee: payload.buyer_flat_fee,
      agreement_length: payload.agreement_length,
      contract_url: payload.contract_url,
      special_notes: payload.special_notes,
      selected_agent_ids: payload.selected_agent_ids || [],
      walkthrough_slots: payload.walkthrough_slots || []
    });

    return Response.json({ draft_id: draft.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});