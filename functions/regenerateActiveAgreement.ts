import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  console.log('[regenerateActiveAgreement v5.0] Starting...');
  
  // CRITICAL: We need the raw body AND original headers to forward to generateLegalAgreement
  // because base44.asServiceRole.functions.invoke returns 403 for function-to-function calls
  const rawBody = await req.text();
  const originalHeaders = new Headers(req.headers);
  
  try {
    // Create a new Request with the same headers but cloned body for SDK auth
    const authReq = new Request(req.url, {
      method: req.method,
      headers: originalHeaders,
      body: rawBody
    });
    
    const base44 = createClientFromRequest(authReq);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log('[regenerateActiveAgreement] Body keys:', Object.keys(body));
    
    const { draft_id, deal_id, room_id, exhibit_a, investor_profile_id, property_address, city, state, zip, county } = body;

    if (!draft_id && !deal_id) {
      return Response.json({ error: 'draft_id or deal_id required' }, { status: 400 });
    }

    console.log('[regenerateActiveAgreement] IDs:', { draft_id, deal_id, room_id });

    // Get calling user's profile
    let profiles;
    try {
      profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    } catch (e) {
      profiles = await base44.entities.Profile.filter({ user_id: user.id });
    }
    const callerProfile = profiles?.[0];
    if (!callerProfile) {
      return Response.json({ error: 'Profile not found for user ' + user.id }, { status: 403 });
    }
    console.log('[regenerateActiveAgreement] Caller:', callerProfile.id, callerProfile.full_name, callerProfile.user_role);

    // Load context
    let dealContext = null;
    let draftContext = null;

    if (draft_id) {
      draftContext = { state, city, county, zip, property_address, investor_profile_id: investor_profile_id || callerProfile?.id };
    } else if (deal_id) {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      dealContext = deals?.[0];
      if (!dealContext) return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Load Room
    let room = null;
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0];
    }

    // Resolve investor profile ID from room/deal (not the caller who might be an agent)
    const resolvedInvestorProfileId = investor_profile_id 
      || room?.investorId 
      || dealContext?.investor_id 
      || callerProfile?.id;
    
    console.log('[regenerateActiveAgreement] Resolved investor:', resolvedInvestorProfileId, 'caller:', callerProfile?.id);

    // Build exhibit_a
    const effectiveTerms = exhibit_a || room?.proposed_terms || dealContext?.proposed_terms || {};
    
    if (!effectiveTerms.buyer_commission_type) {
      return Response.json({ error: 'Missing buyer commission terms' }, { status: 400 });
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
    
    // CRITICAL: Call generateLegalAgreement via direct HTTP with original auth headers
    // base44.asServiceRole.functions.invoke returns 403 for function-to-function calls
    const appId = Deno.env.get('BASE44_APP_ID');
    const functionUrl = `https://base44.app/api/apps/${appId}/functions/generateLegalAgreement`;
    
    // Forward ALL original headers that contain auth info
    const forwardHeaders = {
      'Content-Type': 'application/json',
    };
    // Copy auth-related headers from original request
    for (const [key, value] of originalHeaders.entries()) {
      const lk = key.toLowerCase();
      if (lk === 'authorization' || lk.startsWith('x-base44') || lk === 'cookie') {
        forwardHeaders[key] = value;
      }
    }
    
    console.log('[regenerateActiveAgreement] Calling:', functionUrl, 'with auth headers:', Object.keys(forwardHeaders).filter(k => k !== 'Content-Type'));
    
    const genResponse = await fetch(functionUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(genPayload)
    });
    
    const genData = await genResponse.json();
    console.log('[regenerateActiveAgreement] Response status:', genResponse.status, 'has agreement:', !!genData?.agreement);

    if (!genResponse.ok || genData?.error) {
      console.error('[regenerateActiveAgreement] Generation error:', genData?.error || genResponse.statusText);
      return Response.json({ error: genData?.error || 'Generation failed' }, { status: genResponse.ok ? 400 : genResponse.status });
    }
    
    const newAgreement = genData?.agreement;
    if (!newAgreement?.id) {
      console.error('[regenerateActiveAgreement] No agreement returned');
      return Response.json({ error: 'Generation failed - no agreement returned' }, { status: 500 });
    }

    console.log('[regenerateActiveAgreement] Agreement:', newAgreement.id, 'signer_mode:', newAgreement.signer_mode);

    // Clean new agreement
    await base44.asServiceRole.entities.LegalAgreement.update(newAgreement.id, {
      investor_signed_at: null,
      agent_signed_at: null,
      status: 'sent'
    });

    // Update pointers
    if (room_id && room) {
      const roomUpdate = { current_legal_agreement_id: newAgreement.id, agreement_status: 'draft' };
      if (signerMode === 'investor_only' && room.requires_regenerate) {
        roomUpdate.requires_regenerate = false;
      }
      await base44.asServiceRole.entities.Room.update(room_id, roomUpdate);
    } else if (deal_id && dealContext) {
      await base44.asServiceRole.entities.Deal.update(deal_id, { current_legal_agreement_id: newAgreement.id });
    }

    console.log('[regenerateActiveAgreement] Success');

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