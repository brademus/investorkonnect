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
    
    // CRITICAL: When counter is accepted, update room to require regeneration
    if (action === 'accept' && counter.room_id) {
      try {
        // Get the room to update proposed_terms with counter terms
        const rooms = await base44.asServiceRole.entities.Room.filter({ id: counter.room_id });
        const room = rooms[0];
        
        if (room) {
          // Merge counter terms into room's proposed_terms
          const updatedTerms = {
            ...(room.proposed_terms || {}),
            ...(counter.terms_delta || {})
          };
          
          // Also update agent_terms for each agent in the room
          const updatedAgentTerms = { ...(room.agent_terms || {}) };
          for (const agentId of Object.keys(updatedAgentTerms)) {
            updatedAgentTerms[agentId] = {
              ...(updatedAgentTerms[agentId] || {}),
              ...(counter.terms_delta || {})
            };
          }
          
          await base44.asServiceRole.entities.Room.update(counter.room_id, {
            requires_regenerate: true,
            proposed_terms: updatedTerms,
            agent_terms: updatedAgentTerms,
            agreement_status: 'draft' // Reset to draft since terms changed
          });
          
          console.log('[respondToCounterOffer] Room updated with requires_regenerate=true and new terms:', JSON.stringify(updatedTerms));
          
          // Also update the Deal entity's proposed_terms so all views stay in sync
          if (counter.deal_id) {
            try {
              const deals = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
              if (deals?.[0]) {
                const dealTerms = {
                  ...(deals[0].proposed_terms || {}),
                  ...(counter.terms_delta || {})
                };
                await base44.asServiceRole.entities.Deal.update(counter.deal_id, {
                  proposed_terms: dealTerms
                });
                console.log('[respondToCounterOffer] Deal proposed_terms synced');
              }
            } catch (de) {
              console.warn('[respondToCounterOffer] Failed to sync deal terms:', de.message);
            }
          }
        }
      } catch (e) {
        console.error('[respondToCounterOffer] Failed to update room:', e);
        // Don't fail the whole request if room update fails
      }
    }
    
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