import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { counter_offer_id, action } = body;

    if (!counter_offer_id || !action) {
      return Response.json({ error: "counter_offer_id and action required" }, { status: 400 });
    }
    if (!["accept", "decline"].includes(action)) {
      return Response.json({ error: "action must be accept or decline" }, { status: 400 });
    }

    // Get counter offer
    const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_offer_id });
    if (!counters?.length) {
      return Response.json({ error: "Counter offer not found" }, { status: 404 });
    }
    const counter = counters[0];
    const newStatus = action === "accept" ? "accepted" : "declined";

    // Update counter offer status
    await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
      status: newStatus,
      responded_at: new Date().toISOString(),
      responded_by_role: counter.to_role,
    });

    if (action === 'accept' && counter.deal_id) {
      try {
        const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
        const deal = dealArr?.[0];

        if (deal) {
          // Mark deal as needing regeneration, but do NOT overwrite proposed_terms
          // proposed_terms holds the original investor terms — counter terms are
          // stored per-agent in room.agent_terms so other agents are not affected
          await base44.asServiceRole.entities.Deal.update(deal.id, {
            requires_regenerate: true,
            requires_regenerate_reason: 'counter_offer_accepted',
            pending_counter_agent_id: counter.from_profile_id || null
          });
          console.log('[respondToCounterOffer] Marked deal', deal.id, 'requires_regenerate');

          if (counter.room_id) {
            const rooms = await base44.asServiceRole.entities.Room.filter({ id: counter.room_id });
            const room = rooms?.[0];
            if (room) {
              // Determine which agent this counter belongs to
              // If agent sent the counter, from_profile_id is the agent's ID
              // If investor sent the counter, the agent is the recipient (in the room)
              const counterAgentId = counter.from_role === 'agent'
                ? (counter.from_profile_id || deal.agent_id || room.agent_ids?.[0])
                : (deal.agent_id || room.agent_ids?.[0] || counter.from_profile_id);

              if (counterAgentId) {
                // Store counter terms per-agent in agent_terms — isolated from other agents
                const updatedAgentTerms = { ...(room.agent_terms || {}) };
                const originalTerms = deal.proposed_terms || {};
                updatedAgentTerms[counterAgentId] = {
                  ...(updatedAgentTerms[counterAgentId] || originalTerms),
                  ...(counter.terms_delta || {}),
                  requires_regenerate: true,
                  counter_offer_id: counter.id
                };

                // Update agent_agreement_status only for this specific agent
                const updatedAgentStatus = { ...(room.agent_agreement_status || {}) };
                updatedAgentStatus[counterAgentId] = 'counter_accepted';

                await base44.asServiceRole.entities.Room.update(counter.room_id, {
                  agent_terms: updatedAgentTerms,
                  agent_agreement_status: updatedAgentStatus,
                  // Do NOT update current_legal_agreement_id here — that stays as
                  // the original agreement until regeneration completes for this agent
                });
                console.log('[respondToCounterOffer] Stored counter terms for agent', counterAgentId);
              }
            }
          }
        }
      } catch (e) {
        console.error('[respondToCounterOffer] Deal/Room update error:', e.message);
      }
    }

    return Response.json({
      success: true,
      message: `Counter offer ${newStatus}`,
      counter_id: counter_offer_id,
      status: newStatus,
    });
  } catch (error) {
    console.error("[respondToCounterOffer] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});