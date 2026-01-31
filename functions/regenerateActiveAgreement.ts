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

    // Load Room if room-scoped to get its proposed_terms
    let room = null;
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      room = rooms?.[0] || null;
      if (!room) {
        return Response.json({ error: 'Room not found' }, { status: 404 });
      }
    }

    // Use room-scoped terms if available, otherwise fall back to deal terms
    const effectiveTerms = (room?.proposed_terms && Object.keys(room.proposed_terms).length > 0) 
      ? room.proposed_terms 
      : deal.proposed_terms || {};
    
    if (!effectiveTerms.buyer_commission_type) {
      return Response.json({ 
        error: 'Missing buyer commission terms. Please set commission structure first.'
      }, { status: 400 });
    }

    // Call generateLegalAgreement with effective terms
    const gen = await base44.functions.invoke('generateLegalAgreement', {
      deal_id,
      room_id: room_id || null,
      exhibit_a: {
        buyer_commission_type: effectiveTerms.buyer_commission_type || 'flat',
        buyer_commission_percentage: effectiveTerms.buyer_commission_percentage || null,
        buyer_flat_fee: effectiveTerms.buyer_flat_fee || null,
        agreement_length_days: effectiveTerms.agreement_length || 180,
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

    // Update pointers and clear regenerate flag
    if (room_id && room) {
      await base44.asServiceRole.entities.Room.update(room_id, {
        current_legal_agreement_id: newAgreement.id,
        requires_regenerate: false
      });
    } else {
      await base44.asServiceRole.entities.Deal.update(deal_id, {
        current_legal_agreement_id: newAgreement.id,
        requires_regenerate: false,
        requires_regenerate_reason: null
      });
    }

    return Response.json({ 
      success: true, 
      agreement: newAgreement 
    });
    
  } catch (error) {
    console.error('[regenerateActiveAgreement] Error:', error?.message);
    const errorMsg = error?.response?.data?.error || error?.message || 'Failed to regenerate agreement';
    return Response.json({ 
      error: errorMsg
    }, { status: 500 });
  }
});