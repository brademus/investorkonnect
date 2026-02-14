import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    console.log('[createDealOnInvestorSignature] Received event type:', body?.event?.type, 'entity_id:', body?.event?.entity_id, 'payload_too_large:', body?.payload_too_large);

    let { event, data: agreementData, old_data: oldAgreementData, payload_too_large } = body;

    // Only process update events where investor just signed
    if (event?.type !== 'update') {
      return Response.json({ status: 'ignored', reason: 'not_update_event' });
    }

    // CRITICAL: If payload was too large, fetch the full agreement data from DB
    if (payload_too_large || !agreementData) {
      console.log('[createDealOnInvestorSignature] Payload too large or missing data — fetching agreement from DB');
      const fullAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: event.entity_id });
      if (!fullAgreements?.length) {
        return Response.json({ status: 'error', reason: 'agreement_not_found_after_payload_too_large' }, { status: 404 });
      }
      agreementData = fullAgreements[0];
      // We can't reliably check old_data, but if the agreement has investor_signed_at, proceed
      if (!agreementData.investor_signed_at) {
        return Response.json({ status: 'ignored', reason: 'no_investor_signature_after_refetch' });
      }
      // Since we can't check old_data, skip the wasNotSigned check — the automation
      // is idempotent (duplicate check + existing deal check prevent double creation)
      console.log('[createDealOnInvestorSignature] Refetched agreement:', agreementData.id, 'investor_signed_at:', agreementData.investor_signed_at);
    } else {
      // Check if investor_signed_at was just set (wasn't set before, is set now)
      const wasNotSigned = !oldAgreementData?.investor_signed_at;
      const isNowSigned = !!agreementData?.investor_signed_at;

      if (!(wasNotSigned && isNowSigned)) {
        return Response.json({ status: 'ignored', reason: 'not_new_investor_signature' });
      }
    }

    // Only process base agreements (no room_id)
    if (agreementData?.room_id) {
      return Response.json({ status: 'ignored', reason: 'room_scoped_agreement' });
    }

    console.log('[createDealOnInvestorSignature] Investor just signed base agreement:', agreementData.id);

    // Check if a REAL Deal entity already exists (not a DealDraft)
    // The agreement's deal_id might point to a DealDraft ID in the new flow
    let existingDeal = null;
    
    // PRIMARY: Try by deal_id first — when editing, the agreement's deal_id IS the real Deal ID
    if (agreementData.deal_id) {
      try {
        const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreementData.deal_id });
        if (deals && deals.length > 0) {
          existingDeal = deals[0];
          console.log('[createDealOnInvestorSignature] Found existing deal by deal_id:', existingDeal.id);
        }
      } catch (e) {
        // deal_id might be a DealDraft ID, not a Deal - that's expected
        console.log('[createDealOnInvestorSignature] deal_id is not a Deal entity (likely DealDraft):', agreementData.deal_id);
      }
    }
    
    // FALLBACK: Check by current_legal_agreement_id
    if (!existingDeal) {
      const dealsByAgreement = await base44.asServiceRole.entities.Deal.filter({
        current_legal_agreement_id: agreementData.id
      });
      existingDeal = dealsByAgreement?.[0] || null;
      if (existingDeal) {
        console.log('[createDealOnInvestorSignature] Found existing deal by current_legal_agreement_id:', existingDeal.id);
      }
    }
    
    // FALLBACK 2: Check by investor + property_address to catch edits where pointers were cleared
    if (!existingDeal && agreementData.investor_profile_id) {
      // Load the agreement's deal context to get property address
      let propAddr = null;
      if (agreementData.render_context_json?.PROPERTY_ADDRESS) {
        propAddr = agreementData.render_context_json.PROPERTY_ADDRESS;
      }
      if (propAddr && propAddr !== 'TBD') {
        const dealsByAddr = await base44.asServiceRole.entities.Deal.filter({
          investor_id: agreementData.investor_profile_id,
          property_address: propAddr
        });
        const activeDeal = dealsByAddr?.find(d => d.status !== 'archived' && d.status !== 'closed');
        if (activeDeal) {
          existingDeal = activeDeal;
          console.log('[createDealOnInvestorSignature] Found existing deal by investor+address:', existingDeal.id);
        }
      }
    }

    if (existingDeal) {
      console.log('[createDealOnInvestorSignature] Deal already exists:', existingDeal.id, '- updating agreement links');
      
      // Try to find the DealDraft to pull latest walkthrough + terms data
      let draftForUpdate = null;
      if (agreementData.deal_id) {
        const draftById = await base44.asServiceRole.entities.DealDraft.filter({ id: agreementData.deal_id });
        if (draftById?.length) draftForUpdate = draftById[0];
      }
      if (!draftForUpdate && agreementData.investor_profile_id) {
        const draftsByInv = await base44.asServiceRole.entities.DealDraft.filter({ investor_profile_id: agreementData.investor_profile_id });
        if (draftsByInv?.length) {
          draftsByInv.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          draftForUpdate = draftsByInv[0];
        }
      }

      const dealUpdate = { current_legal_agreement_id: agreementData.id };
      const exhibitTerms = agreementData.exhibit_a_terms || {};

      if (draftForUpdate) {
        dealUpdate.walkthrough_scheduled = draftForUpdate.walkthrough_scheduled === true;
        dealUpdate.walkthrough_datetime = draftForUpdate.walkthrough_datetime || null;
        const dBuyerType = draftForUpdate.buyer_commission_type === 'flat' ? 'flat_fee' : (draftForUpdate.buyer_commission_type || 'percentage');
        const dSellerType = draftForUpdate.seller_commission_type === 'flat' ? 'flat_fee' : (draftForUpdate.seller_commission_type || 'percentage');
        dealUpdate.proposed_terms = {
          seller_commission_type: exhibitTerms.seller_commission_type || dSellerType,
          seller_commission_percentage: exhibitTerms.seller_commission_percentage ?? draftForUpdate.seller_commission_percentage ?? null,
          seller_flat_fee: exhibitTerms.seller_flat_fee ?? draftForUpdate.seller_flat_fee ?? null,
          buyer_commission_type: exhibitTerms.buyer_commission_type || dBuyerType,
          buyer_commission_percentage: exhibitTerms.buyer_commission_percentage ?? draftForUpdate.buyer_commission_percentage ?? null,
          buyer_flat_fee: exhibitTerms.buyer_flat_fee ?? draftForUpdate.buyer_flat_fee ?? null,
          agreement_length: exhibitTerms.agreement_length_days || exhibitTerms.agreement_length || draftForUpdate.agreement_length || null,
        };
      } else if (Object.keys(exhibitTerms).length > 0) {
        if (!existingDeal.proposed_terms || !Object.values(existingDeal.proposed_terms).some(v => v != null)) {
          dealUpdate.proposed_terms = {
            seller_commission_type: exhibitTerms.seller_commission_type || 'percentage',
            seller_commission_percentage: exhibitTerms.seller_commission_percentage ?? null,
            seller_flat_fee: exhibitTerms.seller_flat_fee ?? null,
            buyer_commission_type: exhibitTerms.buyer_commission_type || 'percentage',
            buyer_commission_percentage: exhibitTerms.buyer_commission_percentage ?? null,
            buyer_flat_fee: exhibitTerms.buyer_flat_fee ?? null,
            agreement_length: exhibitTerms.agreement_length_days || exhibitTerms.agreement_length || null,
          };
        }
      }

      // Update Deal
      await base44.asServiceRole.entities.Deal.update(existingDeal.id, dealUpdate);

      // Sync DealAppointments if walkthrough data changed
      if (dealUpdate.walkthrough_scheduled && dealUpdate.walkthrough_datetime) {
        try {
          const apptRows = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: existingDeal.id });
          const apptPatch = {
            walkthrough: {
              status: 'PROPOSED',
              datetime: dealUpdate.walkthrough_datetime,
              timezone: null,
              locationType: 'ON_SITE',
              notes: null,
              updatedByUserId: agreementData.investor_profile_id || null,
              updatedAt: new Date().toISOString()
            }
          };
          if (apptRows?.[0]) {
            await base44.asServiceRole.entities.DealAppointments.update(apptRows[0].id, apptPatch);
          } else {
            await base44.asServiceRole.entities.DealAppointments.create({
              dealId: existingDeal.id,
              ...apptPatch,
              inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
              rescheduleRequests: []
            });
          }
          console.log('[createDealOnInvestorSignature] Synced DealAppointments for existing deal');
        } catch (apptErr) {
          console.warn('[createDealOnInvestorSignature] Failed to sync DealAppointments:', apptErr.message);
        }
      }

      // Update existing Room agreement pointer and status
      const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: existingDeal.id });
      if (existingRooms?.length) {
        const room = existingRooms[0];
        // Reset agent agreement statuses to 'sent' for all agents
        const updatedAgentStatus = {};
        for (const agentId of (room.agent_ids || [])) {
          updatedAgentStatus[agentId] = 'sent';
        }
        // Build room update - include walkthrough if set on deal
        const roomUpdatePayload = {
          current_legal_agreement_id: agreementData.id,
          agreement_status: 'investor_signed',
          requires_regenerate: false,
          agent_agreement_status: updatedAgentStatus
        };
        await base44.asServiceRole.entities.Room.update(room.id, roomUpdatePayload);
        console.log('[createDealOnInvestorSignature] Updated room:', room.id, 'with new agreement');

        // CRITICAL: Link the agreement to the room so Room-page subscriptions can find it
        if (!agreementData.room_id) {
          await base44.asServiceRole.entities.LegalAgreement.update(agreementData.id, {
            room_id: room.id
          });
          console.log('[createDealOnInvestorSignature] Linked agreement', agreementData.id, 'to room', room.id);
        }

        // Update existing DealInvites to point to the new agreement and reset status
        const existingInvites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id: existingDeal.id });
        for (const invite of existingInvites) {
          if (invite.status !== 'LOCKED') {
            await base44.asServiceRole.entities.DealInvite.update(invite.id, {
              legal_agreement_id: agreementData.id,
              status: 'PENDING_AGENT_SIGNATURE'
            });
            console.log('[createDealOnInvestorSignature] Updated invite:', invite.id);
          }
        }

        // Notify agents about updated agreement
        for (const agentId of (room.agent_ids || [])) {
          try {
            const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
            const agent = agentProfiles?.[0];
            if (agent?.email) {
              await base44.asServiceRole.integrations.Core.SendEmail({
                to: agent.email,
                subject: `Updated Agreement - ${existingDeal.title || existingDeal.property_address || 'Deal'}`,
                body: `Hello ${agent.full_name || 'Agent'},\n\nThe investor has updated the agreement for deal: ${existingDeal.title || existingDeal.property_address}.\n\nPlease log in to review the updated terms and sign the new agreement.\n\nBest regards,\nInvestor Konnect Team`
              });
            }
          } catch (emailErr) {
            console.warn('[createDealOnInvestorSignature] Failed to email agent:', agentId, emailErr.message);
          }
        }
      }

      return Response.json({
        status: 'success',
        deal_id: existingDeal.id,
        reason: 'agreement_updated_for_existing_deal'
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
    
    const draftWalkthroughScheduled = draft.walkthrough_scheduled === true;
    const draftWalkthroughDatetime = draft.walkthrough_datetime || null;
    console.log('[createDealOnInvestorSignature] Walkthrough:', draftWalkthroughScheduled, draftWalkthroughDatetime);

    // Validate that we have agents
    if (!selectedAgents || selectedAgents.length === 0) {
      console.error('[createDealOnInvestorSignature] DealDraft has no selected agents!');
      return Response.json({ 
        status: 'error', 
        error: 'no_agents_selected',
        reason: 'DealDraft has no selected_agent_ids'
      }, { status: 400 });
    }

    // DUPLICATE CHECK: Prevent creating a second Deal for the same investor + property address
    // Use broad search by investor_id, then normalize addresses for comparison
    if (draft.investor_profile_id && draft.property_address) {
      const allInvestorDeals = await base44.asServiceRole.entities.Deal.filter({
        investor_id: draft.investor_profile_id
      });
      const normAddr = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const draftAddr = normAddr(draft.property_address);
      const activeDupe = allInvestorDeals.find(d => 
        d.status !== 'archived' && d.status !== 'closed' && normAddr(d.property_address) === draftAddr
      );
      if (activeDupe) {
        console.log('[createDealOnInvestorSignature] DUPLICATE detected! Existing deal:', activeDupe.id, 'for address:', draft.property_address);
        // Update existing deal's agreement pointer instead of creating a new one
        // Build update for the duplicate deal - include walkthrough and terms from draft
        const dupeExhibitTerms = agreementData.exhibit_a_terms || {};
        const dupeBuyerType = draft.buyer_commission_type === 'flat' ? 'flat_fee' : (draft.buyer_commission_type || 'percentage');
        const dupeSellerType = draft.seller_commission_type === 'flat' ? 'flat_fee' : (draft.seller_commission_type || 'percentage');
        const dupeUpdate = {
          current_legal_agreement_id: agreementData.id,
          walkthrough_scheduled: draftWalkthroughScheduled,
          walkthrough_datetime: draftWalkthroughDatetime,
          proposed_terms: {
            seller_commission_type: dupeExhibitTerms.seller_commission_type || dupeSellerType,
            seller_commission_percentage: dupeExhibitTerms.seller_commission_percentage ?? draft.seller_commission_percentage ?? null,
            seller_flat_fee: dupeExhibitTerms.seller_flat_fee ?? draft.seller_flat_fee ?? null,
            buyer_commission_type: dupeExhibitTerms.buyer_commission_type || dupeBuyerType,
            buyer_commission_percentage: dupeExhibitTerms.buyer_commission_percentage ?? draft.buyer_commission_percentage ?? null,
            buyer_flat_fee: dupeExhibitTerms.buyer_flat_fee ?? draft.buyer_flat_fee ?? null,
            agreement_length: dupeExhibitTerms.agreement_length_days || dupeExhibitTerms.agreement_length || draft.agreement_length || null,
          }
        };
        console.log('[createDealOnInvestorSignature] Updating duplicate deal with draft data:', { walkthrough: dupeUpdate.walkthrough_scheduled, terms: dupeUpdate.proposed_terms });
        await base44.asServiceRole.entities.Deal.update(activeDupe.id, dupeUpdate);
        await base44.asServiceRole.entities.LegalAgreement.update(agreementData.id, {
          deal_id: activeDupe.id
        });
        // Update room if exists
        const dupeRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: activeDupe.id });
        if (dupeRooms?.length) {
          await base44.asServiceRole.entities.Room.update(dupeRooms[0].id, {
            current_legal_agreement_id: agreementData.id,
            agreement_status: 'investor_signed',
            requires_regenerate: false
          });
          if (!agreementData.room_id) {
            await base44.asServiceRole.entities.LegalAgreement.update(agreementData.id, { room_id: dupeRooms[0].id });
          }
        }
        // Sync DealAppointments for the duplicate deal
        if (draftWalkthroughScheduled && draftWalkthroughDatetime) {
          try {
            const apptRows = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: activeDupe.id });
            const apptPatch = {
              walkthrough: {
                status: 'PROPOSED',
                datetime: draftWalkthroughDatetime,
                timezone: null,
                locationType: 'ON_SITE',
                notes: null,
                updatedByUserId: draft.investor_profile_id || null,
                updatedAt: new Date().toISOString()
              }
            };
            if (apptRows?.[0]) {
              await base44.asServiceRole.entities.DealAppointments.update(apptRows[0].id, apptPatch);
            } else {
              await base44.asServiceRole.entities.DealAppointments.create({
                dealId: activeDupe.id,
                ...apptPatch,
                inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
                rescheduleRequests: []
              });
            }
          } catch (apptErr) {
            console.warn('[createDealOnInvestorSignature] Failed to sync DealAppointments for dupe:', apptErr.message);
          }
        }
        // Clean up the draft
        try { await base44.asServiceRole.entities.DealDraft.delete(draft.id); } catch (e) { console.warn('Failed to delete draft:', e.message); }
        // Create invites if needed
        try {
          await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', { deal_id: activeDupe.id });
        } catch (e) { console.warn('Failed to create invites:', e.message); }
        return Response.json({ status: 'success', deal_id: activeDupe.id, reason: 'linked_to_existing_deal_duplicate_prevented' });
      }
    }

    // CRITICAL: Use agreement exhibit_a_terms as source of truth for ALL commission terms
    // The agreement was generated with correct values; the draft may have stale/wrong values
    const exhibitTerms = agreementData.exhibit_a_terms || {};
    
    // Normalize draft types (form uses 'flat', DB uses 'flat_fee')
    const draftBuyerType = draft.buyer_commission_type === 'flat' ? 'flat_fee' : (draft.buyer_commission_type || 'percentage');
    const draftSellerType = draft.seller_commission_type === 'flat' ? 'flat_fee' : (draft.seller_commission_type || 'percentage');
    
    // ALWAYS prefer agreement exhibit_a_terms (source of truth) over draft
    const finalBuyerCommType = exhibitTerms.buyer_commission_type || draftBuyerType;
    const finalBuyerCommPct = exhibitTerms.buyer_commission_percentage ?? draft.buyer_commission_percentage ?? null;
    const finalBuyerFlatFee = exhibitTerms.buyer_flat_fee ?? draft.buyer_flat_fee ?? null;
    const finalSellerCommType = exhibitTerms.seller_commission_type || draftSellerType;
    const finalSellerCommPct = exhibitTerms.seller_commission_percentage ?? draft.seller_commission_percentage ?? null;
    const finalSellerFlatFee = exhibitTerms.seller_flat_fee ?? draft.seller_flat_fee ?? null;
    const finalAgreementLength = exhibitTerms.agreement_length_days || exhibitTerms.agreement_length || draft.agreement_length || 180;

    console.log('[createDealOnInvestorSignature] Terms resolution:', {
      exhibit_terms: exhibitTerms,
      draft_buyer_type: draft.buyer_commission_type,
      draft_buyer_pct: draft.buyer_commission_percentage,
      draft_agreement_length: draft.agreement_length,
      final_buyer_type: finalBuyerCommType,
      final_buyer_pct: finalBuyerCommPct,
      final_agreement_length: finalAgreementLength,
    });

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
        seller_commission_type: finalSellerCommType,
        seller_commission_percentage: finalSellerCommPct,
        seller_flat_fee: finalSellerFlatFee,
        buyer_commission_type: finalBuyerCommType,
        buyer_commission_percentage: finalBuyerCommPct,
        buyer_flat_fee: finalBuyerFlatFee,
        agreement_length: finalAgreementLength,
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
      current_legal_agreement_id: agreementData.id,
      walkthrough_scheduled: draftWalkthroughScheduled,
      walkthrough_datetime: draftWalkthroughDatetime
    });
    
    console.log('[createDealOnInvestorSignature] Created Deal:', newDeal.id, 'walkthrough_scheduled:', newDeal.walkthrough_scheduled, 'walkthrough_datetime:', newDeal.walkthrough_datetime);

    // Create DealAppointments record if walkthrough was scheduled
    if (draftWalkthroughScheduled && draftWalkthroughDatetime) {
      try {
        await base44.asServiceRole.entities.DealAppointments.create({
          dealId: newDeal.id,
          walkthrough: {
            status: 'PROPOSED',
            datetime: draftWalkthroughDatetime,
            timezone: null,
            locationType: 'ON_SITE',
            notes: null,
            updatedByUserId: draft.investor_profile_id || null,
            updatedAt: new Date().toISOString()
          },
          inspection: { status: 'NOT_SET', datetime: null, timezone: null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
          rescheduleRequests: []
        });
        console.log('[createDealOnInvestorSignature] Created DealAppointments for walkthrough');
      } catch (apptErr) {
        console.warn('[createDealOnInvestorSignature] Failed to create DealAppointments (non-fatal):', apptErr.message);
      }
    }

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