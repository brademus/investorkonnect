import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * CREATE DEAL DRAFT
 * Called from NewDeal page when investor submits details
 * Creates a DealDraft (not visible to anyone) and generates base agreement
 * Returns draft_id and agreement_id for MyAgreement page
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile || profile.user_role !== 'investor') {
      return Response.json({ error: 'Only investors can create deals' }, { status: 403 });
    }

    const body = await req.json();
    const {
      property_address,
      city,
      state,
      zip,
      county,
      purchase_price,
      property_type,
      beds,
      baths,
      sqft,
      year_built,
      number_of_stories,
      has_basement,
      seller_name,
      earnest_money,
      number_of_signers,
      second_signer_name,
      seller_commission_type,
      seller_commission_percentage,
      seller_flat_fee,
      buyer_commission_type,
      buyer_commission_percentage,
      buyer_flat_fee,
      agreement_length,
      contract_url,
      special_notes,
      closing_date,
      contract_date,
      selected_agent_ids
    } = body;

    // Validation
    if (!property_address || !city || !state || !zip || !purchase_price) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!selected_agent_ids || !Array.isArray(selected_agent_ids) || selected_agent_ids.length === 0) {
      return Response.json({ error: 'Must select at least one agent' }, { status: 400 });
    }

    // Create DealDraft
    const draft = await base44.asServiceRole.entities.DealDraft.create({
      investor_profile_id: profile.id,
      property_address,
      city,
      state,
      zip,
      county,
      purchase_price: Number(purchase_price),
      property_type,
      beds: beds ? Number(beds) : null,
      baths: baths ? Number(baths) : null,
      sqft: sqft ? Number(sqft) : null,
      year_built: year_built ? Number(year_built) : null,
      number_of_stories,
      has_basement,
      seller_name,
      earnest_money: earnest_money ? Number(earnest_money) : null,
      number_of_signers,
      second_signer_name,
      seller_commission_type,
      seller_commission_percentage: seller_commission_type === 'percentage' ? Number(seller_commission_percentage) : null,
      seller_flat_fee: seller_commission_type === 'flat_fee' ? Number(seller_flat_fee) : null,
      buyer_commission_type,
      buyer_commission_percentage: buyer_commission_type === 'percentage' ? Number(buyer_commission_percentage) : null,
      buyer_flat_fee: buyer_commission_type === 'flat_fee' ? Number(buyer_flat_fee) : null,
      agreement_length: agreement_length ? Number(agreement_length) : 180,
      contract_url,
      special_notes,
      closing_date,
      contract_date,
      selected_agent_ids
    });

    console.log('[createDealDraft] Created draft:', draft.id);

    return Response.json({
      success: true,
      draft_id: draft.id
    });
  } catch (error) {
    console.error('[createDealDraft] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});