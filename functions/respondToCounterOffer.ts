import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[respondToCounterOffer] Rate limited, retrying`);
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
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Load counter offer
    const counter = await withRetry(async () => {
      const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_offer_id });
      if (!counters?.length) throw new Error('Counter offer not found');
      return counters[0];
    });

    if (counter.status !== 'pending') {
      return Response.json({ error: `Counter already ${counter.status}` }, { status: 400 });
    }

    // Get user profile
    const profile = await withRetry(async () => {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (!profiles?.length) throw new Error('Profile not found');
      return profiles[0];
    });

    const userRole = profile.user_role;
    if (userRole !== counter.to_role) {
      return Response.json({ error: 'Only recipient can respond' }, { status: 403 });
    }

    // Get deal
    const deal = await withRetry(async () => {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
      if (!deals?.length) throw new Error('Deal not found');
      return deals[0];
    });

    // Handle actions
    // Get existing terms (handle both old 'terms' and new 'terms_delta' fields)
    const existingTerms = counter.terms_delta || counter.terms || {};

    if (action === 'decline') {
      await withRetry(async () => {
        await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
          status: 'declined',
          terms_delta: existingTerms,
          responded_at: new Date().toISOString(),
          responded_by_role: userRole
        });
      });
      return Response.json({ success: true, action: 'declined' });
    }

    if (action === 'recounter') {
      if (!terms_delta) {
        return Response.json({ error: 'terms_delta required for recounter' }, { status: 400 });
      }

      // Mark old counter as superseded
      await withRetry(async () => {
        await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
          status: 'superseded',
          terms_delta: existingTerms,
          responded_at: new Date().toISOString(),
          responded_by_role: userRole
        });
      });

      // Create new counter with flipped roles
      const newCounter = await withRetry(async () => {
        return await base44.asServiceRole.entities.CounterOffer.create({
          deal_id: counter.deal_id,
          from_role: userRole,
          to_role: counter.from_role,
          status: 'pending',
          terms_delta
        });
      });

      return Response.json({ success: true, action: 'recountered', counter_offer: newCounter });
    }

    if (action === 'accept') {
      // Get the terms to accept (from counter, not deal)
      const acceptedTerms = counter.terms_delta || counter.terms || {};
      
      // Mark counter as accepted
      await withRetry(async () => {
        await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
          status: 'accepted',
          terms_delta: existingTerms,
          responded_at: new Date().toISOString(),
          responded_by_role: userRole
        });
      });

      // Update deal proposed_terms with accepted counter terms
      await withRetry(async () => {
        await base44.asServiceRole.entities.Deal.update(counter.deal_id, {
          proposed_terms: acceptedTerms
        });
      });

      console.log('[respondToCounterOffer] Accepted counter with terms:', acceptedTerms);
      return Response.json({ success: true, action: 'accepted', accepted_terms: acceptedTerms });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[respondToCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});