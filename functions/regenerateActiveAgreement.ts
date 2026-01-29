import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deal_id, room_id } = await req.json();
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    console.log('[regenerateActiveAgreement] Mode:', room_id ? 'ROOM-SCOPED' : 'LEGACY');

    // Verify investor
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (profile.user_role !== 'investor') {
      return Response.json({ error: 'Only investor can regenerate' }, { status: 403 });
    }

    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals?.length) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];

    const terms = deal.proposed_terms || {};
    if (!terms.buyer_commission_type) {
      return Response.json({ 
        error: 'Missing buyer commission terms in deal. Please set commission structure first.',
        details: 'Deal needs proposed_terms with buyer_commission_type',
        deal_id: deal.id,
        has_terms: !!deal.proposed_terms
      }, { status: 400 });
    }

    // Identify current active agreement to void (room-scoped or legacy)
    let currentAgreement = null;
    let room = null;
    
    if (room_id) {
      // ROOM-SCOPED: Look for room-specific agreement that was previously regenerated
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0] || null;

      if (!room) {
        return Response.json({ error: 'Room not found' }, { status: 404 });
      }

      if (room.current_legal_agreement_id) {
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ id: room.current_legal_agreement_id });
        currentAgreement = a?.[0] || null;
      } else {
        // Only look for room-scoped agreements (room_id not null)
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id, room_id }, '-created_date', 1);
        currentAgreement = a?.[0] || null;
      }
      console.log('[regenerateActiveAgreement] Room-scoped current agreement:', currentAgreement?.id);
    } else {
      // DEAL-LEVEL: Only for initial generation (should not regenerate at deal level)
      if (deal.current_legal_agreement_id) {
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ id: deal.current_legal_agreement_id });
        currentAgreement = a?.[0] || null;
      } else {
        // Only deal-level (room_id null)
        const a = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id, room_id: null }, '-created_date', 1);
        currentAgreement = a?.[0] || null;
      }
      console.log('[regenerateActiveAgreement] Deal-level current agreement:', currentAgreement?.id);
    }

    // Skip voiding old DocuSign envelope - not critical for regeneration
    if (currentAgreement?.docusign_envelope_id) {
      console.log('[regenerateActiveAgreement] Old envelope exists but skipping void (not critical)');
    }

    // Mark old agreement as superseded
    if (currentAgreement?.id) {
      await base44.asServiceRole.entities.LegalAgreement.update(currentAgreement.id, {
        status: 'superseded',
        docusign_status: 'voided'
      });
      console.log('[regenerateActiveAgreement] Old agreement marked superseded');
    }

    // Call generateLegalAgreement with simplified error handling
    console.log('[regenerateActiveAgreement] Generating with terms:', terms);
    
    const gen = await base44.functions.invoke('generateLegalAgreement', {
      deal_id,
      room_id: room_id || null,
      exhibit_a: {
        buyer_commission_type: terms.buyer_commission_type || 'flat',
        buyer_commission_percentage: terms.buyer_commission_percentage || null,
        buyer_flat_fee: terms.buyer_flat_fee || null,
        agreement_length_days: terms.agreement_length || 180,
        transaction_type: deal.transaction_type || 'ASSIGNMENT'
      }
    });

    if (gen.data?.error) {
      return Response.json({ 
        error: gen.data.error, 
        details: gen.data 
      }, { status: 400 });
    }
    
    const newAgreement = gen.data?.agreement;
    if (!newAgreement?.id) {
      return Response.json({ 
        error: 'Generation failed - no agreement returned' 
      }, { status: 500 });
    }

    console.log('[regenerateActiveAgreement] ✓ New agreement created:', newAgreement.id);

    // Update pointers and clear regenerate flag (room-scoped or legacy)
    if (room_id && room) {
      await base44.asServiceRole.entities.Room.update(room_id, {
        current_legal_agreement_id: newAgreement.id,
        requires_regenerate: false
      });
      console.log('[regenerateActiveAgreement] ✓ Room updated with new agreement pointer');
    } else {
      await base44.asServiceRole.entities.Deal.update(deal_id, {
        current_legal_agreement_id: newAgreement.id,
        requires_regenerate: false,
        requires_regenerate_reason: null
      });
      console.log('[regenerateActiveAgreement] ✓ Deal updated with new agreement pointer (legacy)');
    }

    return Response.json({ 
      success: true, 
      agreement: newAgreement 
    });
    
  } catch (error) {
    console.error('[regenerateActiveAgreement] Fatal error:', error);
    console.error('[regenerateActiveAgreement] Error type:', error?.constructor?.name);
    console.error('[regenerateActiveAgreement] Error response:', error?.response?.data);
    console.error('[regenerateActiveAgreement] Error message:', error?.message);
    
    const errorMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to regenerate agreement';
    return Response.json({ 
      error: errorMsg,
      details: error?.response?.data 
    }, { status: 500 });
  }
});