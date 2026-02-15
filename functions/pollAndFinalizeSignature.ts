import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Called by DocuSignReturn after investor signs.
 * Polls DocuSign to confirm signature, updates LegalAgreement,
 * then directly creates Deal + invites (doesn't rely on webhook timing).
 */
async function getDocuSignConnection(base44) {
  const conns = await base44.asServiceRole.entities.DocuSignConnection.list('-created_date', 1);
  if (!conns?.length) throw new Error('DocuSign not connected');
  let conn = conns[0];
  if (conn.expires_at && new Date() >= new Date(conn.expires_at) && conn.refresh_token) {
    const tokenUrl = conn.base_uri.includes('demo') ? 'https://account-d.docusign.com/oauth/token' : 'https://account.docusign.com/oauth/token';
    const resp = await fetch(tokenUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refresh_token, client_id: Deno.env.get('DOCUSIGN_INTEGRATION_KEY'), client_secret: Deno.env.get('DOCUSIGN_CLIENT_SECRET') })
    });
    if (!resp.ok) throw new Error('Token refresh failed');
    const tokens = await resp.json();
    const exp = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await base44.asServiceRole.entities.DocuSignConnection.update(conn.id, { access_token: tokens.access_token, refresh_token: tokens.refresh_token || conn.refresh_token, expires_at: exp });
    conn.access_token = tokens.access_token;
  }
  return conn;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { agreement_id, role } = await req.json();
    if (!agreement_id) return Response.json({ error: 'agreement_id required' }, { status: 400 });

    // Load agreement
    const agArr = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    const agreement = agArr?.[0];
    if (!agreement) return Response.json({ error: 'Agreement not found' }, { status: 404 });

    console.log('[pollAndFinalize] Agreement:', agreement.id, 'status:', agreement.status, 'mode:', agreement.signer_mode);

    // If already signed, skip polling
    if (role === 'investor' && agreement.investor_signed_at) {
      console.log('[pollAndFinalize] Already signed, checking if deal exists');
      return await ensureDealCreated(base44, agreement);
    }

    // Poll DocuSign for up to 10 seconds
    const conn = await getDocuSignConnection(base44);
    let signed = false;

    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      
      const recipUrl = `${conn.base_uri}/restapi/v2.1/accounts/${conn.account_id}/envelopes/${agreement.docusign_envelope_id}/recipients`;
      const recipResp = await fetch(recipUrl, { headers: { 'Authorization': `Bearer ${conn.access_token}` } });
      
      if (recipResp.ok) {
        const recipData = await recipResp.json();
        const signers = recipData.signers || [];
        
        if (role === 'investor') {
          const inv = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id || '1'));
          if (inv?.status === 'completed') {
            signed = true;
            console.log('[pollAndFinalize] Investor signature confirmed on attempt', i + 1);

            // Check if agent also signed already (unlikely but possible)
            const ag = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id || '2'));
            const agentAlsoSigned = ag?.status === 'completed';

            const updates = {
              investor_signed_at: inv.signedDateTime || new Date().toISOString(),
              status: agentAlsoSigned ? 'fully_signed' : 'investor_signed',
              docusign_status: agentAlsoSigned ? 'completed' : 'sent'
            };
            if (agentAlsoSigned && !agreement.agent_signed_at) {
              updates.agent_signed_at = ag.signedDateTime || new Date().toISOString();
            }
            await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
            Object.assign(agreement, updates);
            break;
          }
        } else if (role === 'agent') {
          const ag = signers.find(s => String(s.recipientId) === String(agreement.agent_recipient_id || '2'));
          if (ag?.status === 'completed') {
            signed = true;
            console.log('[pollAndFinalize] Agent signature confirmed on attempt', i + 1);
            
            // Check if investor also signed to determine final status
            const inv = signers.find(s => String(s.recipientId) === String(agreement.investor_recipient_id || '1'));
            const investorAlsoSigned = inv?.status === 'completed' || !!agreement.investor_signed_at;
            const finalStatus = investorAlsoSigned ? 'fully_signed' : 'agent_signed';
            
            const updates = {
              agent_signed_at: ag.signedDateTime || new Date().toISOString(),
              status: finalStatus,
              docusign_status: investorAlsoSigned ? 'completed' : 'delivered'
            };
            // Also capture investor_signed_at if not yet recorded
            if (inv?.status === 'completed' && !agreement.investor_signed_at) {
              updates.investor_signed_at = inv.signedDateTime || new Date().toISOString();
            }
            await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, updates);
            Object.assign(agreement, updates);
            break;
          }
        }
      }
    }

    if (!signed) {
      console.log('[pollAndFinalize] Signature not confirmed after polling - webhook will handle it');
      return Response.json({ status: 'pending', message: 'Signature not yet confirmed. Webhook will process.' });
    }

    // For investor signatures: ensure deal + invites are created
    if (role === 'investor') {
      return await ensureDealCreated(base44, agreement);
    }

    // For agent signatures: update room/invite status and trigger lock-in if fully signed
    if (role === 'agent' && agreement.status === 'fully_signed') {
      console.log('[pollAndFinalize] Agent signature makes it fully_signed, updating room & deal');
      const roomId = agreement.room_id;
      if (roomId) {
        // Update room agreement_status
        await base44.asServiceRole.entities.Room.update(roomId, {
          agreement_status: 'fully_signed',
          request_status: 'signed'
        }).catch(e => console.error('[pollAndFinalize] Room update error:', e.message));

        // Update DealInvite status
        if (agreement.agent_profile_id) {
          const invites = await base44.asServiceRole.entities.DealInvite.filter({
            deal_id: agreement.deal_id, agent_profile_id: agreement.agent_profile_id
          }).catch(() => []);
          if (invites?.[0]) {
            await base44.asServiceRole.entities.DealInvite.update(invites[0].id, { status: 'LOCKED' }).catch(() => {});
          }
        }

        // Lock deal to winning agent
        const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id }).catch(() => []);
        const deal = dealArr?.[0];
        if (deal && !deal.locked_agent_id && agreement.agent_profile_id) {
          const now = new Date().toISOString();
          await base44.asServiceRole.entities.Deal.update(deal.id, {
            locked_room_id: roomId,
            locked_agent_id: agreement.agent_profile_id,
            agent_id: agreement.agent_profile_id,
            connected_at: now,
            pipeline_stage: 'connected_deals',
            selected_agent_ids: [agreement.agent_profile_id]
          }).catch(e => console.error('[pollAndFinalize] Deal lock error:', e.message));
          console.log('[pollAndFinalize] Deal locked to agent', agreement.agent_profile_id);
        }
      }
    }

    return Response.json({ status: 'signed', agreement_id: agreement.id });
  } catch (error) {
    console.error('[pollAndFinalize] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function ensureDealCreated(base44, agreement) {
  // Check if Deal already exists for this agreement
  const dealsByAgreement = await base44.asServiceRole.entities.Deal.filter({
    current_legal_agreement_id: agreement.id
  });
  
  if (dealsByAgreement?.length > 0) {
    const deal = dealsByAgreement[0];
    console.log('[pollAndFinalize] Deal already exists:', deal.id);
    
    // Make sure invites exist
    const invites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id: deal.id });
    if (invites.length === 0) {
      console.log('[pollAndFinalize] No invites yet, creating them');
      await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', { deal_id: deal.id });
    }
    
    // Find room
    const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
    return Response.json({ 
      status: 'deal_exists', 
      deal_id: deal.id, 
      room_id: rooms?.[0]?.id || null 
    });
  }

  // Also check by deal_id on agreement (might already point to a real Deal)
  if (agreement.deal_id) {
    const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id }).catch(() => []);
    if (dealArr?.length > 0) {
      const deal = dealArr[0];
      console.log('[pollAndFinalize] Found deal by agreement.deal_id:', deal.id);
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
      return Response.json({ status: 'deal_exists', deal_id: deal.id, room_id: rooms?.[0]?.id || null });
    }
  }

  // Deal doesn't exist yet - create it from DealDraft
  console.log('[pollAndFinalize] No deal found, creating from DealDraft');
  
  // Find DealDraft: agreement.deal_id likely points to DealDraft.id
  let draft = null;
  if (agreement.deal_id) {
    const draftArr = await base44.asServiceRole.entities.DealDraft.filter({ id: agreement.deal_id }).catch(() => []);
    draft = draftArr?.[0] || null;
  }
  if (!draft && agreement.investor_profile_id) {
    const draftArr = await base44.asServiceRole.entities.DealDraft.filter({ investor_profile_id: agreement.investor_profile_id }, '-created_date', 1);
    draft = draftArr?.[0] || null;
  }
  
  if (!draft) {
    console.error('[pollAndFinalize] No DealDraft found');
    return Response.json({ error: 'No DealDraft found' }, { status: 404 });
  }

  const selectedAgents = draft.selected_agent_ids || [];
  if (selectedAgents.length === 0) {
    return Response.json({ error: 'No agents selected' }, { status: 400 });
  }

  console.log('[pollAndFinalize] Creating deal from draft:', draft.id, 'agents:', selectedAgents);

  // Resolve walkthrough fields from draft
  const draftWtScheduled = draft.walkthrough_scheduled === true;
  const draftWtDate = (draftWtScheduled && draft.walkthrough_date && String(draft.walkthrough_date).length >= 8) ? draft.walkthrough_date : null;
  const draftWtTime = (draftWtScheduled && draft.walkthrough_time && String(draft.walkthrough_time).length >= 3) ? draft.walkthrough_time : null;
  console.log('[pollAndFinalize] Walkthrough from draft:', { draftWtScheduled, draftWtDate, draftWtTime });

  // Resolve commission terms — prefer agreement exhibit_a_terms (source of truth), fall back to draft
  const exhibitTerms = agreement.exhibit_a_terms || {};
  const draftBuyerType = draft.buyer_commission_type === 'flat' ? 'flat_fee' : (draft.buyer_commission_type || 'percentage');
  const draftSellerType = draft.seller_commission_type === 'flat' ? 'flat_fee' : (draft.seller_commission_type || 'percentage');

  // Create Deal
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
      seller_commission_type: exhibitTerms.seller_commission_type || draftSellerType,
      seller_commission_percentage: exhibitTerms.seller_commission_percentage ?? draft.seller_commission_percentage ?? null,
      seller_flat_fee: exhibitTerms.seller_flat_fee ?? draft.seller_flat_fee ?? null,
      buyer_commission_type: exhibitTerms.buyer_commission_type || draftBuyerType,
      buyer_commission_percentage: exhibitTerms.buyer_commission_percentage ?? draft.buyer_commission_percentage ?? null,
      buyer_flat_fee: exhibitTerms.buyer_flat_fee ?? draft.buyer_flat_fee ?? null,
      agreement_length: exhibitTerms.agreement_length_days || exhibitTerms.agreement_length || draft.agreement_length || 180,
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
    current_legal_agreement_id: agreement.id,
    walkthrough_scheduled: draftWtScheduled,
    walkthrough_date: draftWtDate,
    walkthrough_time: draftWtTime
  });

  console.log('[pollAndFinalize] Created Deal:', newDeal.id, 'walkthrough:', draftWtScheduled, draftWtDate, draftWtTime);

  // Update agreement to point to real Deal
  await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, {
    deal_id: newDeal.id,
    status: 'investor_signed'
  });

  // Delete DealDraft
  await base44.asServiceRole.entities.DealDraft.delete(draft.id).catch(() => {});

  // Create invites + room
  try {
    await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', { deal_id: newDeal.id });
    console.log('[pollAndFinalize] Invites created');
  } catch (e) {
    console.error('[pollAndFinalize] Failed to create invites:', e.message);
  }

  // Get room
  const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: newDeal.id });

  return Response.json({
    status: 'deal_created',
    deal_id: newDeal.id,
    room_id: rooms?.[0]?.id || null
  });
}