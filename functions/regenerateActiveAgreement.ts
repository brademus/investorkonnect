import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function withRetry(fn, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500;
        console.log(`[regenerateActiveAgreement] Rate limited (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

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

    // Verify investor with retry
    const profile = await withRetry(async () => {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (!profiles?.[0]) throw new Error('Profile not found');
      return profiles[0];
    });
    
    if (profile.user_role !== 'investor') {
      return Response.json({ error: 'Only investor can regenerate' }, { status: 403 });
    }

    // Load deal with retry
    const deal = await withRetry(async () => {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      if (!deals?.length) throw new Error('Deal not found');
      return deals[0];
    });

    // Load Room if room-scoped to get its proposed_terms
    let room = null;
    if (room_id) {
      room = await withRetry(async () => {
        const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
        if (!rooms?.[0]) throw new Error('Room not found');
        return rooms[0];
      });
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

    // CRITICAL: Ensure new agreement has no signatures (safety - should already be clean from generation)
    await withRetry(async () => {
      await base44.asServiceRole.entities.LegalAgreement.update(newAgreement.id, {
        investor_signed_at: null,
        agent_signed_at: null,
        status: 'draft'
      });
    });

    // Update pointers and reset agreement signing status with retry
    // Keep regenerate flag until investor completes signing via DocuSign callback
    if (room_id && room) {
      await withRetry(async () => {
        await base44.asServiceRole.entities.Room.update(room_id, {
          current_legal_agreement_id: newAgreement.id,
          agreement_status: 'draft'  // Reset to draft - no signatures yet
          // DO NOT clear requires_regenerate - cleared by webhook after investor signs
        });
      });
    } else {
      await withRetry(async () => {
        await base44.asServiceRole.entities.Deal.update(deal_id, {
          current_legal_agreement_id: newAgreement.id
          // DO NOT clear requires_regenerate - cleared by webhook after investor signs
        });
      });
    }

    // Return signing URL so frontend can redirect immediately
    return Response.json({ 
      success: true, 
      agreement: newAgreement,
      signing_url: newAgreement.docusign_signing_url || null
    });
    
  } catch (error) {
    console.error('[regenerateActiveAgreement] Error:', error?.message);
    const errorMsg = error?.response?.data?.error || error?.message || 'Failed to regenerate agreement';
    return Response.json({ 
      error: errorMsg
    }, { status: 500 });
  }
});