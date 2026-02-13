const BASE_URL = "https://app.base44.com/api";
const APP_ID = Deno.env.get("BASE44_APP_ID");

async function serviceHeaders(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  return {
    "Content-Type": "application/json",
    "x-app-id": APP_ID,
    "authorization": `Bearer ${token}`,
  };
}

async function getMe(req) {
  const h = await serviceHeaders(req);
  const r = await fetch(`${BASE_URL}/me`, { headers: h });
  if (!r.ok) return null;
  return r.json();
}

async function filterEntity(req, entity, query) {
  const h = await serviceHeaders(req);
  const r = await fetch(`${BASE_URL}/entities/${entity}/query`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(query),
  });
  if (!r.ok) return [];
  return r.json();
}

async function updateEntity(req, entity, id, data) {
  const h = await serviceHeaders(req);
  const r = await fetch(`${BASE_URL}/entities/${entity}/${id}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Update ${entity}/${id} failed: ${txt}`);
  }
  return r.json();
}

Deno.serve(async (req) => {
  try {
    const user = await getMe(req);
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
    const counters = await filterEntity(req, "CounterOffer", { id: counter_offer_id });
    if (!counters?.length) {
      return Response.json({ error: "Counter offer not found" }, { status: 404 });
    }
    const counter = counters[0];
    const newStatus = action === "accept" ? "accepted" : "declined";

    // Update counter offer status
    await updateEntity(req, "CounterOffer", counter_offer_id, {
      status: newStatus,
      responded_at: new Date().toISOString(),
      responded_by_role: counter.to_role,
    });

    // When counter is accepted, update agent-specific terms on the Room
    if (action === "accept" && counter.room_id) {
      try {
        const rooms = await filterEntity(req, "Room", { id: counter.room_id });
        const room = rooms?.[0];

        if (room) {
          let targetAgentId = null;

          if (counter.from_role === "agent" && counter.from_profile_id) {
            targetAgentId = counter.from_profile_id;
          } else if (counter.from_role === "investor" && counter.to_profile_id) {
            targetAgentId = counter.to_profile_id;
          }

          if (!targetAgentId && counter.deal_id) {
            const invites = await filterEntity(req, "DealInvite", {
              deal_id: counter.deal_id,
              room_id: counter.room_id,
            });
            if (invites?.length === 1) {
              targetAgentId = invites[0].agent_profile_id;
            }
          }

          if (!targetAgentId && room.agent_ids?.length === 1) {
            targetAgentId = room.agent_ids[0];
          }

          console.log("[respondToCounterOffer] Target agent:", targetAgentId);

          const updatedAgentTerms = { ...(room.agent_terms || {}) };
          if (targetAgentId) {
            updatedAgentTerms[targetAgentId] = {
              ...(updatedAgentTerms[targetAgentId] || room.proposed_terms || {}),
              ...(counter.terms_delta || {}),
            };
            updatedAgentTerms[targetAgentId].requires_regenerate = true;
          }

          const mergedProposedTerms = {
            ...(room.proposed_terms || {}),
            ...(counter.terms_delta || {}),
          };

          await updateEntity(req, "Room", counter.room_id, {
            requires_regenerate: true,
            agent_terms: updatedAgentTerms,
            proposed_terms: mergedProposedTerms,
            agreement_status: "draft",
          });

          console.log("[respondToCounterOffer] Room updated for agent", targetAgentId);
        }
      } catch (e) {
        console.error("[respondToCounterOffer] Room update error:", e.message);
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