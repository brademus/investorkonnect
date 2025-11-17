import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { completeJSON } from './lib/openaiContractsClient.js';

const CONTRACT_TEMPLATES = [
  { id: "buyer_rep_v1", name: "Buyer Representation Agreement" },
  { id: "referral_v1", name: "Referral Agreement" },
  { id: "services_v1", name: "Real Estate Services Agreement" }
];

async function audit(base44, actor_profile_id, action, entity_type, entity_id, meta = {}) {
  try {
    await base44.entities.AuditLog.create({
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      meta,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Audit failed:", e);
  }
}

function toCompactTranscript(messages) {
  const MAX = 150;
  const recent = messages.slice(-MAX).map(m => {
    const who = m.sender_profile_id || "USER";
    return `[${new Date(m.created_date).toISOString()}] ${who}: ${m.body}`;
  });
  let txt = recent.join("\n");
  if (txt.length > 15000) txt = txt.slice(-15000);
  return txt;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const room_id = url.searchParams.get("room_id");

    if (!room_id) {
      return Response.json({ error: "room_id required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];

    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const rooms = await base44.entities.Room.filter({ id: room_id });
    const room = rooms[0];

    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    if (![room.investorId, room.agentId].includes(profile.id)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load messages
    const messages = await base44.entities.Message.filter({ room_id });
    const transcript = toCompactTranscript(messages || []);

    // Get profile names for context
    const investorProfiles = await base44.entities.Profile.filter({ id: room.investorId });
    const agentProfiles = await base44.entities.Profile.filter({ id: room.agentId });
    const investor = investorProfiles[0];
    const agent = agentProfiles[0];

    const system = `You are a contracts analyst. Extract structured deal terms from a chat transcript and choose the most appropriate contract template id from this list: ${CONTRACT_TEMPLATES.map(t => t.id).join(", ")}. 

Output JSON with this structure:
{
  "suggested_template_id": "buyer_rep_v1",
  "confidence": 0.85,
  "terms": {
    "investor_name": "...",
    "agent_name": "...",
    "property_region": "...",
    "term_start": "2025-01-01",
    "term_end": "2025-12-31",
    "fee_structure": "...",
    "retainer_amount": "5000",
    "exclusivity": "exclusive/non-exclusive"
  },
  "missing_fields": ["retainer_amount", "term_end"],
  "plain_summary": "Brief summary of the deal"
}

Do not invent facts; if unknown, leave fields out so they appear under missing_fields.`;

    const userPrompt = `Room ID: ${room_id}
Investor: ${investor?.full_name || investor?.email || "Unknown"}
Agent: ${agent?.full_name || agent?.email || "Unknown"}

Chat Transcript (most recent):
${transcript}`;

    const result = await completeJSON(system, userPrompt);

    await audit(base44, profile.id, "contract.analyze", "Room", room_id, {
      template: result.suggested_template_id,
      missing: result.missing_fields?.length || 0
    });

    return Response.json({ ok: true, analysis: result });
  } catch (error) {
    console.error('[contractAnalyzeChat] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});