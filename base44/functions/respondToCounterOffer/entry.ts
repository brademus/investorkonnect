import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Respond to a counter offer: accept or decline.
 * Since each deal is now per-agent, accepting a counter updates ONLY that deal's proposed_terms.
 * No cross-contamination with other agents' deals.
 */
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

    // When counter is accepted, update the DEAL's proposed_terms directly
    // Each deal is now single-agent, so this only affects the one deal
    if (action === "accept" && counter.deal_id) {
      try {
        const dealArr = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
        const deal = dealArr?.[0];
        
        if (deal) {
          // Merge counter terms into deal's proposed_terms
          const updatedTerms = {
            ...(deal.proposed_terms || {}),
            ...(counter.terms_delta || {})
          };
          
          // Mark deal as requiring agreement regeneration
          await base44.asServiceRole.entities.Deal.update(deal.id, {
            proposed_terms: updatedTerms,
            requires_regenerate: true,
            requires_regenerate_reason: 'counter_offer_accepted'
          });
          console.log("[respondToCounterOffer] Updated deal", deal.id, "proposed_terms with counter terms");
          
          // Also update room agent_terms for backward compatibility
          if (counter.room_id) {
            const rooms = await base44.asServiceRole.entities.Room.filter({ id: counter.room_id });
            const room = rooms?.[0];
            if (room) {
              const targetAgentId = deal.agent_id || room.agent_ids?.[0];
              if (targetAgentId) {
                const updatedAgentTerms = { ...(room.agent_terms || {}) };
                updatedAgentTerms[targetAgentId] = {
                  ...(updatedAgentTerms[targetAgentId] || room.proposed_terms || {}),
                  ...(counter.terms_delta || {}),
                  requires_regenerate: true
                };
                await base44.asServiceRole.entities.Room.update(counter.room_id, {
                  agent_terms: updatedAgentTerms,
                  requires_regenerate: true
                });
                console.log("[respondToCounterOffer] Updated room agent_terms for", targetAgentId);
              }
            }
          }
        }
      } catch (e) {
        console.error("[respondToCounterOffer] Deal/Room update error:", e.message);
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