import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { draft_id, deal_id, room_id, exhibit_a, investor_profile_id, property_address, city, state, zip } = await req.json();

    if (!draft_id && !deal_id) {
      return Response.json({ error: 'draft_id or deal_id required' }, { status: 400 });
    }

    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 403 });
    }

    // Load DealDraft (pre-signing flow) or Deal (post-counter flow)
    let dealContext = null;
    let draftContext = null;

    if (draft_id) {
      // For draft flow, use request params directly - DealDraft may or may not exist yet
      // The generateLegalAgreement function will use these params
      draftContext = {
        state: state,
        city: city,
        zip: zip,
        property_address: property_address,
        investor_profile_id: investor_profile_id || profile?.id
      };
      console.log('[regenerateActiveAgreement] Using draft context from request params:', draftContext);
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

    // Build exhibit_a: prefer request param, then room terms, then deal terms
    const effectiveTerms = exhibit_a || room?.proposed_terms || dealContext?.proposed_terms || draftContext || {};
    
    if (!effectiveTerms.buyer_commission_type) {
      return Response.json({ 
        error: 'Missing buyer commission terms' 
      }, { status: 400 });
    }

    // Call generateLegalAgreement
    const gen = await base44.functions.invoke('generateLegalAgreement', {
      draft_id: draft_id || undefined,
      deal_id: deal_id || undefined,
      room_id: room_id || null,
      signer_mode: draft_id ? 'investor_only' : (room_id ? 'agent_only' : 'both'),
      exhibit_a: {
        buyer_commission_type: effectiveTerms.buyer_commission_type,
        buyer_commission_percentage: effectiveTerms.buyer_commission_percentage || null,
        buyer_flat_fee: effectiveTerms.buyer_flat_fee || null,
        agreement_length_days: effectiveTerms.agreement_length || 180,
        transaction_type: 'ASSIGNMENT'
      },
      investor_profile_id: investor_profile_id || profile?.id,
      property_address: property_address || draftContext?.property_address || dealContext?.property_address,
      city: city || draftContext?.city || dealContext?.city,
      state: state || draftContext?.state || dealContext?.state,
      zip: zip || draftContext?.zip || dealContext?.zip
    });

    if (gen.data?.error) {
      return Response.json({ error: gen.data.error }, { status: 400 });
    }
    
    const newAgreement = gen.data?.agreement;
    if (!newAgreement?.id) {
      return Response.json({ error: 'Generation failed' }, { status: 500 });
    }

    // Clean new agreement (no signatures yet)
    await base44.asServiceRole.entities.LegalAgreement.update(newAgreement.id, {
      investor_signed_at: null,
      agent_signed_at: null,
      status: 'draft'
    });

    // Update pointers based on context
    if (room_id && room) {
      // Room-scoped regenerate (after counter)
      await base44.asServiceRole.entities.Room.update(room_id, {
        current_legal_agreement_id: newAgreement.id,
        agreement_status: 'draft',
        requires_regenerate: false
      });
    } else if (deal_id && dealContext) {
      // Deal-scoped regenerate
      await base44.asServiceRole.entities.Deal.update(deal_id, {
        current_legal_agreement_id: newAgreement.id
      });
    }
    // draft_id flow: agreement is linked, will be used to create Deal on signing

    return Response.json({ 
      success: true, 
      agreement: newAgreement,
      signing_url: newAgreement.docusign_signing_url || null
    });
    
  } catch (error) {
    console.error('[regenerateActiveAgreement] Error:', error?.message);
    return Response.json({ 
      error: error?.message || 'Failed to regenerate agreement'
    }, { status: 500 });
  }
});