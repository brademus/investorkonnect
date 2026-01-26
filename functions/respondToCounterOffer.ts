import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_offer_id });
    if (!counters || counters.length === 0) {
      return Response.json({ error: 'Counter offer not found' }, { status: 404 });
    }
    const counter = counters[0];
    
    if (counter.status !== 'pending') {
      return Response.json({ error: `Counter offer is already ${counter.status}` }, { status: 400 });
    }
    
    // Verify user has access
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    const responderRole = profile.user_role;
    if (responderRole !== counter.to_role) {
      return Response.json({ error: 'Only the recipient can respond to this counter offer' }, { status: 403 });
    }
    
    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
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
        terms_delta,
        superseded_by_counter_offer_id: counter_offer_id
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
      
      console.log('[respondToCounterOffer] ✓ Accepted terms merged into deal');
      
      // Trigger regeneration
      const regenResponse = await base44.functions.invoke('regenerateAgreementVersion', {
        deal_id: counter.deal_id
      });
      
      return Response.json({
        success: true,
        action: 'accepted',
        counter_offer: { ...counter, status: 'accepted' },
        regeneration: regenResponse.data
      });
    }
    
  } catch (error) {
    console.error('[respondToCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});