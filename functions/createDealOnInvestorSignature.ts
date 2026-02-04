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

    // Check if Deal already exists for this agreement (new flow creates it immediately)
    const deals = await base44.asServiceRole.entities.Deal.filter({
      current_legal_agreement_id: agreementData.id
    });

    if (deals && deals.length > 0) {
      console.log('[createDealOnInvestorSignature] Deal already exists:', deals[0].id, '- creating invites');
      
      // Deal was created in MyAgreement.js - just create invites and update agreement
      const deal = deals[0];
      
      try {
        await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', {
          deal_id: deal.id
        });
        console.log('[createDealOnInvestorSignature] Created agent invites');
      } catch (e) {
        console.error('[createDealOnInvestorSignature] Failed to create invites:', e.message);
      }

      return Response.json({
        status: 'success',
        deal_id: deal.id,
        reason: 'invites_created_for_existing_deal'
      });
    }

    // Fallback: Try to find DealDraft by legal_agreement_id first, then by investor_profile_id
    const investorId = agreementData.investor_profile_id;
    console.log('[createDealOnInvestorSignature] Looking for DealDraft - agreement:', agreementData.id, 'investor:', investorId);

    let drafts = [];
    
    // PRIORITY 1: Try to find by legal_agreement_id (most accurate)
    try {
      drafts = await base44.asServiceRole.entities.DealDraft.filter({
        legal_agreement_id: agreementData.id
      });
      console.log('[createDealOnInvestorSignature] Found', drafts.length, 'drafts by legal_agreement_id');
    } catch (e) {
      console.log('[createDealOnInvestorSignature] Query by legal_agreement_id failed:', e.message);
    }
    
    // PRIORITY 2: If not found, try by investor_profile_id (most recent)
    if ((!drafts || drafts.length === 0) && investorId) {
      try {
        drafts = await base44.asServiceRole.entities.DealDraft.filter({
          investor_profile_id: investorId
        }, '-created_date', 5); // Get 5 most recent
        console.log('[createDealOnInvestorSignature] Found', drafts.length, 'drafts by investor_profile_id');
      } catch (e) {
        console.log('[createDealOnInvestorSignature] Query by investor_profile_id failed:', e.message);
      }
    }

    // Filter by most recent created if multiple found
    if (drafts && drafts.length > 0) {
      drafts.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      console.log('[createDealOnInvestorSignature] Selected most recent draft:', drafts[0].id);
      drafts = [drafts[0]]; // Take most recent
    }

    if (!drafts || drafts.length === 0) {
      console.error('[createDealOnInvestorSignature] ERROR: No DealDraft found!', {
        agreement_id: agreementData.id,
        investor_profile_id: investorId,
        deal_id: agreementData.deal_id
      });
      return Response.json({ 
        status: 'error', 
        error: 'no_deal_draft_found',
        reason: 'Could not find DealDraft for this investor',
        debug: {
          agreement_id: agreementData.id,
          investor_profile_id: investorId
        }
      }, { status: 404 });
    }

    const draft = drafts[0];
    console.log('[createDealOnInvestorSignature] Found DealDraft:', draft.id, 'with agents:', draft.selected_agent_ids);

    // CRITICAL: Validate that draft has selected agents
    if (!draft.selected_agent_ids || draft.selected_agent_ids.length === 0) {
      console.error('[createDealOnInvestorSignature] DealDraft has no selected agents!', {
        draft_id: draft.id,
        investor_id: draft.investor_profile_id
      });
      return Response.json({ 
        status: 'error', 
        error: 'no_agents_selected',
        reason: 'DealDraft has no selected agents'
      }, { status: 400 });
    }

    // Create the Deal entity (old flow)
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
    try {
      await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', {
        deal_id: newDeal.id
      });
      console.log('[createDealOnInvestorSignature] Created agent invites');
    } catch (inviteError) {
      console.error('[createDealOnInvestorSignature] Failed to create invites:', inviteError.message);
      // Don't fail the whole operation if invites fail - deal is still created
    }

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