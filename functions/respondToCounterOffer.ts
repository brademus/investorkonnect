import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Retry helper with exponential backoff for rate limiting
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`[respondToCounterOffer] Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
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
    
    const { counter_offer_id, action, terms_delta } = await req.json();
    
    if (!counter_offer_id || !action) {
      return Response.json({ error: 'counter_offer_id and action required' }, { status: 400 });
    }
    
    if (!['accept', 'decline', 'recounter'].includes(action)) {
      return Response.json({ error: 'action must be accept, decline, or recounter' }, { status: 400 });
    }
    
    if (action === 'recounter' && !terms_delta) {
      return Response.json({ error: 'terms_delta required for recounter action' }, { status: 400 });
    }
    
    // Load counter offer
    const counter = await withRetry(async () => {
      const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_offer_id });
      if (!counters || counters.length === 0) {
        throw new Error('Counter offer not found');
      }
      return counters[0];
    });
    
    if (counter.status !== 'pending') {
      return Response.json({ error: `Counter offer is already ${counter.status}` }, { status: 400 });
    }
    
    // Verify user has access
    const profile = await withRetry(async () => {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (!profiles || profiles.length === 0) {
        throw new Error('Profile not found');
      }
      return profiles[0];
    });
    
    const responderRole = profile.user_role;
    if (responderRole !== counter.to_role) {
      return Response.json({ error: 'Only the recipient can respond to this counter offer' }, { status: 403 });
    }
    
    // Load deal
    const deal = await withRetry(async () => {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
      if (!deals || deals.length === 0) {
        throw new Error('Deal not found');
      }
      return deals[0];
    });
    
    // Handle decline
    if (action === 'decline') {
      await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
        status: 'declined',
        responded_at: new Date().toISOString(),
        responded_by_role: responderRole
      });
      
      return Response.json({
        success: true,
        action: 'declined',
        counter_offer: { ...counter, status: 'declined' }
      });
    }
    
    // Handle recounter
    if (action === 'recounter') {
      // Mark current counter as superseded
      await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
        status: 'superseded',
        responded_at: new Date().toISOString(),
        responded_by_role: responderRole
      });
      
      // Create new counter with flipped roles
      const newCounter = await base44.asServiceRole.entities.CounterOffer.create({
        deal_id: counter.deal_id,
        from_role: responderRole,
        to_role: counter.from_role,
        status: 'pending',
        terms_delta
      });
      
      return Response.json({
        success: true,
        action: 'recountered',
        counter_offer: newCounter
      });
    }
    
    // Handle accept
    if (action === 'accept') {
      // Mark counter as accepted
      await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
        status: 'accepted',
        responded_at: new Date().toISOString(),
        responded_by_role: responderRole
      });
      
      // Merge accepted terms into Deal.proposed_terms (canonical accepted state)
      const currentTerms = deal.proposed_terms || {};
      const acceptedTerms = {
        ...currentTerms,
        ...counter.terms_delta
      };
      
      await base44.asServiceRole.entities.Deal.update(counter.deal_id, {
        proposed_terms: acceptedTerms
      });
      
      console.log('[respondToCounterOffer] ✓ Terms accepted and saved to deal');
      console.log('[respondToCounterOffer] ⏸️  Waiting for investor to regenerate');
      
      // DO NOT auto-regenerate - investor must click "Regenerate & Sign"
      
      return Response.json({
        success: true,
        action: 'accepted',
        counter_offer: { ...counter, status: 'accepted' },
        message: 'Terms accepted. Investor must regenerate the agreement.'
      });
    }
    
  } catch (error) {
    console.error('[respondToCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});