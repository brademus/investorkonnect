import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  console.log('[regenerateActiveAgreement v2.0] Starting...');
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

    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 403 });
    }

    // Load context
    let dealContext = null;
    let draftContext = null;

    if (draft_id) {
      // Draft flow - use request params
      draftContext = {
        state: state,
        city: city,
        county: county,
        zip: zip,
        property_address: property_address,
        investor_profile_id: investor_profile_id || profile?.id
      };
      console.log('[regenerateActiveAgreement] Draft context:', draftContext);
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

    // Build exhibit_a - prioritize room terms (updated by counter offers) over deal terms
    const effectiveTerms = exhibit_a || room?.proposed_terms || dealContext?.proposed_terms || {};
    
    console.log('[regenerateActiveAgreement] Effective terms:', JSON.stringify(effectiveTerms));
    
    if (!effectiveTerms.buyer_commission_type) {
      return Response.json({ 
        error: 'Missing buyer commission terms. Room proposed_terms: ' + JSON.stringify(room?.proposed_terms) + ', Deal proposed_terms: ' + JSON.stringify(dealContext?.proposed_terms)
      }, { status: 400 });
    }

    console.log('[regenerateActiveAgreement] Calling generateLegalAgreement...');

    // Determine signer_mode:
    // - draft flow (pre-signing): investor_only
    // - room-scoped with requires_regenerate (counter accepted, investor must re-sign): investor_only  
    // - room-scoped otherwise (agent signing after investor signed base): agent_only
    // - no room: both
    let signerMode = 'both';
    if (draft_id) {
      signerMode = 'investor_only';
    } else if (room_id && room?.requires_regenerate) {
      // Counter was accepted - investor needs to regenerate and sign with new terms
      signerMode = 'investor_only';
    } else if (room_id) {
      signerMode = 'agent_only';
    }
    console.log('[regenerateActiveAgreement] signer_mode:', signerMode, 'requires_regenerate:', room?.requires_regenerate);

    // Call generateLegalAgreement using service role since the calling user (agent)
    // may not own the deal entity, and generateLegalAgreement uses asServiceRole internally
    const gen = await base44.asServiceRole.functions.invoke('generateLegalAgreement', {
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
      investor_profile_id: investor_profile_id || profile?.id,
      property_address: property_address || draftContext?.property_address || dealContext?.property_address,
      city: city || draftContext?.city || dealContext?.city,
      state: state || draftContext?.state || dealContext?.state,
      zip: zip || draftContext?.zip || dealContext?.zip,
      county: county || draftContext?.county || dealContext?.county
    });
    
    console.log('[regenerateActiveAgreement] generateLegalAgreement response status:', gen.status);

    if (gen.data?.error) {
      console.error('[regenerateActiveAgreement] Generation error:', gen.data.error);
      return Response.json({ error: gen.data.error }, { status: 400 });
    }
    
    const newAgreement = gen.data?.agreement;
    if (!newAgreement?.id) {
      console.error('[regenerateActiveAgreement] No agreement returned');
      return Response.json({ error: 'Generation failed - no agreement returned' }, { status: 500 });
    }

    console.log('[regenerateActiveAgreement] Agreement created:', newAgreement.id);

    // Clean new agreement (no signatures yet)
    await base44.asServiceRole.entities.LegalAgreement.update(newAgreement.id, {
      investor_signed_at: null,
      agent_signed_at: null,
      status: 'draft'
    });

    // Update pointers based on context
    if (room_id && room) {
      // Room-scoped regenerate
      const roomUpdate = {
        current_legal_agreement_id: newAgreement.id,
        agreement_status: 'draft'
      };
      // Only clear requires_regenerate when investor is regenerating after counter acceptance
      // When agent calls this to create their agent_only agreement, don't touch requires_regenerate
      if (signerMode === 'investor_only' && room.requires_regenerate) {
        roomUpdate.requires_regenerate = false;
      }
      await base44.asServiceRole.entities.Room.update(room_id, roomUpdate);
    } else if (deal_id && dealContext) {
      // Deal-scoped regenerate
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
    // Extract inner error details from Axios response if available
    const innerError = error?.response?.data?.error || error?.data?.error || error?.message || 'Failed to regenerate agreement';
    return Response.json({ 
      error: innerError
    }, { status: 500 });
  }
});