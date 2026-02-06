import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Investor or agent responds to a counter offer (accept/decline)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const { counter_offer_id, action } = body;
    
    if (!counter_offer_id || !action) {
      return Response.json({ error: 'counter_offer_id and action required' }, { status: 400 });
    }
    
    if (!['accept', 'decline'].includes(action)) {
      return Response.json({ error: 'action must be accept or decline' }, { status: 400 });
    }
    
    // Get counter offer
    const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_offer_id });
    if (!counters?.length) {
      return Response.json({ error: 'Counter offer not found' }, { status: 404 });
    }
    
    const counter = counters[0];
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    
    // Update counter offer status
    await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
      status: newStatus,
      responded_at: new Date().toISOString(),
      responded_by_role: counter.to_role
    });
    
    return Response.json({ 
      success: true, 
      message: `Counter offer ${newStatus}`,
      counter_id: counter_offer_id,
      status: newStatus
    });
    
  } catch (error) {
    console.error('[respondToCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});