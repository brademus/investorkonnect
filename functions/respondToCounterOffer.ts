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
    
    // CRITICAL: When counter is accepted, update ONLY the specific agent's terms (not all agents)
    if (action === 'accept' && counter.room_id) {
      try {
        const rooms = await base44.asServiceRole.entities.Room.filter({ id: counter.room_id });
        const room = rooms[0];
        
        if (room) {
          // Determine which agent this counter is for
          let targetAgentId = null;

          // Priority 1: Use from_profile_id if agent sent the counter
          if (counter.from_role === 'agent' && counter.from_profile_id) {
            targetAgentId = counter.from_profile_id;
          }
          // Priority 2: Use to_profile_id if investor sent the counter to a specific agent
          else if (counter.from_role === 'investor' && counter.to_profile_id) {
            targetAgentId = counter.to_profile_id;
          }

          // Priority 3: Find the DealInvite for this room to identify the specific agent
          if (!targetAgentId && counter.deal_id) {
            const invites = await base44.asServiceRole.entities.DealInvite.filter({
              deal_id: counter.deal_id,
              room_id: counter.room_id
            });
            if (invites?.length === 1) {
              targetAgentId = invites[0].agent_profile_id;
            }
          }

          // Priority 4: if room only has one agent, use that
          if (!targetAgentId && room.agent_ids?.length === 1) {
            targetAgentId = room.agent_ids[0];
          }

          console.log('[respondToCounterOffer] Target agent for counter:', targetAgentId);

          // Only update agent_terms for THIS specific agent, leave others untouched
          const updatedAgentTerms = { ...(room.agent_terms || {}) };
          if (targetAgentId) {
            updatedAgentTerms[targetAgentId] = {
              ...(updatedAgentTerms[targetAgentId] || room.proposed_terms || {}),
              ...(counter.terms_delta || {})
            };
          }
          
          // Update room: set per-agent requires_regenerate flag and agent-specific terms
          // DO NOT update room.proposed_terms — that stays as the original deal terms for other agents
          // DO NOT set room-level requires_regenerate — use agent_terms[agentId].requires_regenerate instead
          const agentTermsEntry = updatedAgentTerms[targetAgentId] || {};
          agentTermsEntry.requires_regenerate = true;
          updatedAgentTerms[targetAgentId] = agentTermsEntry;
          
          // Also update the room's proposed_terms with the accepted counter terms
          // so that downstream consumers (pipeline, enriched rooms) see the latest terms
          const mergedProposedTerms = { ...(room.proposed_terms || {}), ...(counter.terms_delta || {}) };

          await base44.asServiceRole.entities.Room.update(counter.room_id, {
            requires_regenerate: true, // Keep room-level for backward compat / investor UI
            agent_terms: updatedAgentTerms,
            proposed_terms: mergedProposedTerms,
            agreement_status: 'draft' // Reset to draft since terms changed
          });
          
          console.log('[respondToCounterOffer] Room updated — only agent', targetAgentId, 'terms changed:', JSON.stringify(updatedAgentTerms[targetAgentId]));
          
          // DO NOT update Deal.proposed_terms — those are the original terms shared by all agents
        }
      } catch (e) {
        console.error('[respondToCounterOffer] Failed to update room:', e);
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