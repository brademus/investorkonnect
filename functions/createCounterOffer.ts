import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deal_id, from_role, terms_delta } = await req.json();
    
    if (!deal_id || !from_role || !terms_delta) {
      return Response.json({ error: 'deal_id, from_role, and terms_delta required' }, { status: 400 });
    }
    
    if (!['investor', 'agent'].includes(from_role)) {
      return Response.json({ error: 'from_role must be investor or agent' }, { status: 400 });
    }
    
    // Verify user has access to this deal
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Verify role matches
    if (profile.user_role !== from_role) {
      return Response.json({ error: 'Role mismatch' }, { status: 403 });
    }
    
    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Verify user is participant
    if (from_role === 'investor' && deal.investor_id !== profile.id) {
      return Response.json({ error: 'Not authorized for this deal' }, { status: 403 });
    }
    if (from_role === 'agent' && deal.agent_id !== profile.id) {
      return Response.json({ error: 'Not authorized for this deal' }, { status: 403 });
    }
    
    // Supersede any existing pending counter for this deal
    const existingPending = await base44.asServiceRole.entities.CounterOffer.filter({ 
      deal_id, 
      status: 'pending' 
    });
    
    for (const existing of existingPending) {
      await base44.asServiceRole.entities.CounterOffer.update(existing.id, {
        status: 'superseded',
        responded_at: new Date().toISOString()
      });
      console.log('[createCounterOffer] Superseded existing pending offer:', existing.id);
    }
    
    // Create new counter offer with original terms snapshot
    const toRole = from_role === 'investor' ? 'agent' : 'investor';
    const originalTerms = deal.proposed_terms || {};
    
    const newCounter = await base44.asServiceRole.entities.CounterOffer.create({
      deal_id,
      from_role,
      to_role: toRole,
      status: 'pending',
      terms_delta,
      original_terms_snapshot: originalTerms
    });
    
    console.log('[createCounterOffer] ✓ Created new counter offer:', newCounter.id);
    
    return Response.json({
      success: true,
      counter_offer: newCounter,
      deal: deal
    });
    
  } catch (error) {
    console.error('[createCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});