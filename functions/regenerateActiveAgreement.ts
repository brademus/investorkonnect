import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  console.log('[regenerateActiveAgreement v4.0] Starting...');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[regenerateActiveAgreement] Body keys:', Object.keys(body));
    
    const { draft_id, deal_id, room_id, exhibit_a, investor_profile_id, property_address, city, state, zip, county } = body;

    if (!draft_id && !deal_id) {
      return Response.json({ error: 'draft_id or deal_id required' }, { status: 400 });
    }

    console.log('[regenerateActiveAgreement] IDs:', { draft_id, deal_id, room_id });

    // Get calling user's profile
    console.log('[regenerateActiveAgreement] Looking up caller profile for user:', user.id, user.email);
    let profiles;
    try {
      profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    } catch (e) {
      console.error('[regenerateActiveAgreement] Profile lookup error:', e?.message);
      profiles = await base44.entities.Profile.filter({ user_id: user.id });
    }
    const callerProfile = profiles?.[0];
    if (!callerProfile) {
      return Response.json({ error: 'Profile not found for user ' + user.id }, { status: 403 });
    }
    console.log('[regenerateActiveAgreement] Caller profile:', callerProfile.id, callerProfile.full_name, callerProfile.user_role);

    // Load context
    let dealContext = null;
    let draftContext = null;

    if (draft_id) {
      draftContext = {
        state, city, county, zip, property_address,
        investor_profile_id: investor_profile_id || callerProfile?.id
      };
    } else if (deal_id) {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      dealContext = deals?.[0];
      if (!dealContext) {
        return Response.json({ error: 'Deal not found' }, { status: 404 });
      }
    }

    // Load Room if room-scoped
    let room = null;
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0];
    }

    // CRITICAL: Resolve the correct investor profile ID from room/deal, not the caller
    const resolvedInvestorProfileId = investor_profile_id 
      || room?.investorId 
      || dealContext?.investor_id 
      || callerProfile?.id;
    
    console.log('[regenerateActiveAgreement] Resolved investor profile:', resolvedInvestorProfileId, 
      'caller:', callerProfile?.id, 'callerRole:', callerProfile?.user_role);

    // Build exhibit_a - prioritize room terms (updated by counter offers) over deal terms
    const effectiveTerms = exhibit_a || room?.proposed_terms || dealContext?.proposed_terms || {};
    
    console.log('[regenerateActiveAgreement] Effective terms:', JSON.stringify(effectiveTerms));
    
    if (!effectiveTerms.buyer_commission_type) {
      return Response.json({ 
        error: 'Missing buyer commission terms. Room proposed_terms: ' + JSON.stringify(room?.proposed_terms) + ', Deal proposed_terms: ' + JSON.stringify(dealContext?.proposed_terms)
      }, { status: 400 });
    }

    // Determine signer_mode
    let signerMode = 'both';
    if (draft_id) {
      signerMode = 'investor_only';
    } else if (room_id && room?.requires_regenerate) {
      signerMode = 'investor_only';
    } else if (room_id) {
      signerMode = 'agent_only';
    }
    console.log('[regenerateActiveAgreement] signer_mode:', signerMode, 'requires_regenerate:', room?.requires_regenerate);

    const genPayload = {
      draft_id: draft_id || undefined,
      deal_id: deal_id || undefined,
      room_id: room_id || null,
      signer_mode: signerMode,
      exhibit_a: {
        buyer_commission_type: effectiveTerms.buyer_commission_type,
        buyer_commission_percentage: effectiveTerms.buyer_commission_percentage || null,
        buyer_flat_fee: effectiveTerms.buyer_flat_fee || null,
        agreement_length_days: effectiveTerms.agreement_length || effectiveTerms.agreement_length_days || 180,
        transaction_type: effectiveTerms.transaction_type || 'ASSIGNMENT'
      },
      investor_profile_id: resolvedInvestorProfileId,
      property_address: property_address || draftContext?.property_address || dealContext?.property_address,
      city: city || draftContext?.city || dealContext?.city,
      state: state || draftContext?.state || dealContext?.state,
      zip: zip || draftContext?.zip || dealContext?.zip,
      county: county || draftContext?.county || dealContext?.county
    };
    console.log('[regenerateActiveAgreement] genPayload:', JSON.stringify(genPayload));
    
    // Call generateLegalAgreement using service role SDK
    console.log('[regenerateActiveAgreement] Invoking generateLegalAgreement via service role...');
    const gen = await base44.asServiceRole.functions.invoke('generateLegalAgreement', genPayload);
    
    console.log('[regenerateActiveAgreement] Response status:', gen.status);

    if (gen.data?.error) {
      console.error('[regenerateActiveAgreement] Generation error:', gen.data.error);
      return Response.json({ error: gen.data.error }, { status: 400 });
    }
    
    const newAgreement = gen.data?.agreement;
    if (!newAgreement?.id) {
      console.error('[regenerateActiveAgreement] No agreement returned. Full response:', JSON.stringify(gen.data));
      return Response.json({ error: 'Generation failed - no agreement returned' }, { status: 500 });
    }

    console.log('[regenerateActiveAgreement] Agreement created:', newAgreement.id, 'signer_mode:', newAgreement.signer_mode);

    // Clean new agreement - keep status as 'sent' since DocuSign envelope is already created
    await base44.asServiceRole.entities.LegalAgreement.update(newAgreement.id, {
      investor_signed_at: null,
      agent_signed_at: null,
      status: 'sent'
    });

    // Update pointers based on context
    if (room_id && room) {
      const roomUpdate = {
        current_legal_agreement_id: newAgreement.id,
        agreement_status: 'draft'
      };
      // Only clear requires_regenerate when investor is regenerating after counter acceptance
      if (signerMode === 'investor_only' && room.requires_regenerate) {
        roomUpdate.requires_regenerate = false;
      }
      await base44.asServiceRole.entities.Room.update(room_id, roomUpdate);
    } else if (deal_id && dealContext) {
      await base44.asServiceRole.entities.Deal.update(deal_id, {
        current_legal_agreement_id: newAgreement.id
      });
    }

    console.log('[regenerateActiveAgreement] Success - returning agreement');

    return Response.json({ 
      success: true, 
      agreement: newAgreement,
      signing_url: newAgreement.docusign_signing_url || null
    });
    
  } catch (error) {
    console.error('[regenerateActiveAgreement] Exception:', error?.message, error?.stack);
    const innerError = error?.response?.data?.error || error?.data?.error || error?.message || 'Failed to regenerate agreement';
    return Response.json({ error: innerError }, { status: 500 });
  }
});