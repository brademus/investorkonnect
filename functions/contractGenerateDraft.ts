import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { completeText, generateContractDraft } from './lib/openaiContractsClient.js';

const CONTRACT_TEMPLATES = [
  {
    id: "buyer_rep_v1",
    name: "Buyer Representation Agreement",
    body: `
BUYER REPRESENTATION AGREEMENT (v1)

This Agreement is entered into between {{investor_name}} ("Buyer") and {{agent_name}} ("Agent") regarding representation for acquisitions in {{property_region}}.

1. Scope. Agent will identify, analyze, and present properties aligned to Buyer's strategy: {{strategy_summary}}.

2. Term. From {{term_start}} to {{term_end}}.

3. Exclusivity. {{exclusivity}}.

4. Compensation. {{fee_structure}}. Retainer (if applicable): {{retainer_amount}} {{retainer_currency}}.

5. Confidentiality & NDA. Parties acknowledge NDA signed within AgentVault.

6. Milestones & Payments. As scheduled inside AgentVault Deal Room {{room_ref}}.

7. Termination. {{termination_rights}}.

8. Governing Law. {{governing_law}}.

Buyer: ____________________    Date: _________
Agent: ____________________    Date: _________
`
  },
  {
    id: "referral_v1",
    name: "Referral Agreement",
    body: `
REFERRAL AGREEMENT (v1)

Between {{referrer_name}} ("Referrer") and {{referee_name}} ("Referee").

Scope: {{referral_scope}}.
Compensation: {{referral_fee}} paid on closed transactions introduced by Referrer before {{term_end}}.
NDA acknowledged via AgentVault. Other terms: {{other_terms}}.

Referrer: ____________________    Date: _________
Referee:  ____________________    Date: _________
`
  },
  {
    id: "services_v1",
    name: "Real Estate Services Agreement",
    body: `
SERVICES AGREEMENT (v1)

Client: {{client_name}}
Provider: {{provider_name}}
Services: {{services}}
Payment Terms: {{payment_terms}}
Term: {{term_start}} to {{term_end}}
NDA acknowledged via AgentVault. Dispute Resolution: {{dispute_resolution}}.

Client:   ____________________    Date: _________
Provider: ____________________    Date: _________
`
  }
];

function renderTemplate(templateBody, terms) {
  return templateBody.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const v = terms?.[key];
    return (v === undefined || v === null) ? `<<${key}>>` : String(v);
  });
}

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { room_id, template_id, terms } = body || {};

    if (!room_id || !template_id || !terms) {
      return Response.json({ error: "room_id, template_id, terms required" }, { status: 400 });
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

    const template = CONTRACT_TEMPLATES.find(t => t.id === template_id);
    if (!template) {
      return Response.json({ error: "Unknown template" }, { status: 400 });
    }

    // Render template with terms
    const enrichedTerms = {
      room_ref: room_id,
      retainer_currency: terms.retainer_currency || "USD",
      governing_law: terms.governing_law || "Delaware",
      termination_rights: terms.termination_rights || "Either party may terminate on 7 days' written notice.",
      dispute_resolution: terms.dispute_resolution || "Good-faith negotiation; then binding arbitration.",
      strategy_summary: terms.strategy_summary || terms.strategy || "Investment strategy per profile.",
      ...terms
    };

    const baseDoc = renderTemplate(template.body, enrichedTerms);

    // Generate polished contract using GPT-4o
    const dealContext = {
      room_id,
      investor_name: enrichedTerms.investor_name,
      agent_name: enrichedTerms.agent_name,
      property_region: enrichedTerms.property_region
    };
    
    const polished = await generateContractDraft(baseDoc, enrichedTerms, dealContext);

    // Create contract record
    const contract = await base44.entities.Contract.create({
      room_id,
      template_id,
      status: "draft",
      terms_json: enrichedTerms,
      draft_html_url: null,
      created_by_profile_id: profile.id
    });

    await audit(base44, profile.id, "contract.generate", "Contract", contract.id, { template_id });

    return Response.json({
      ok: true,
      contract,
      content: polished,
      draft_url: null
    });
  } catch (error) {
    console.error('[contractGenerateDraft] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});