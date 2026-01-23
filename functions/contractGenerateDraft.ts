import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { completeText, generateContractDraft, generateDraftWithPrompt, analyzeContractWithPrompt } from './lib/openaiContractsClient.js';

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

function toCompactTranscript(messages) {
  const MAX = 200;
  const recent = messages.slice(-MAX).map(m => {
    const who = m.sender_profile_id || "USER";
    return `[${new Date(m.created_date).toISOString()}] ${who}: ${m.body}`;
  });
  let txt = recent.join("\n");
  if (txt.length > 20000) txt = txt.slice(-20000);
  return txt;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { room_id, template_id, terms, mode } = body || {};

    // MODE: AI_FLOW - Full two-step AI contract flow
    if (false && mode === "ai_flow" && room_id) {
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

      // Step 1: Get conversation transcript
      const messages = await base44.entities.Message.filter({ room_id });
      const conversationText = toCompactTranscript(messages || []);

      if (!conversationText || conversationText.length < 50) {
        return Response.json({ 
          error: "Not enough conversation to generate contract",
          hint: "Please have more discussion in the Deal Room before generating a contract"
        }, { status: 400 });
      }

      // Get party names
      const investorProfiles = await base44.entities.Profile.filter({ id: room.investorId });
      const agentProfiles = await base44.entities.Profile.filter({ id: room.agentId });
      const investor = investorProfiles[0];
      const agent = agentProfiles[0];

      const enrichedConversation = `Deal Room: ${room_id}
Investor: ${investor?.full_name || investor?.email || "Unknown Investor"}
Agent: ${agent?.full_name || agent?.email || "Unknown Agent"}

Conversation Transcript:
${conversationText}`;

      // Step 2: Generate draft using Drafting Prompt ID
      const draftContent = await generateDraftWithPrompt(enrichedConversation, {
        investor_name: investor?.full_name,
        agent_name: agent?.full_name
      });

      // Step 3: Analyze draft using Analysis Prompt ID
      const riskProfile = {
        riskTolerance: profile.metadata?.risk_tolerance || 'moderate',
        experience: profile.metadata?.experience_level || 'intermediate'
      };
      
      const analysis = await analyzeContractWithPrompt(draftContent, { riskProfile });

      // Step 4: Create contract record
      const contract = await base44.entities.Contract.create({
        room_id,
        template_id: "ai_generated",
        status: "draft",
        terms_json: {
          investor_name: investor?.full_name,
          agent_name: agent?.full_name,
          generated_at: new Date().toISOString(),
          ai_flow: true
        },
        draft_html_url: null,
        created_by_profile_id: profile.id
      });

      // Audit
      try {
        await base44.entities.AuditLog.create({
          actor_profile_id: profile.id,
          action: "contract.ai_flow_generate",
          entity_type: "Contract",
          entity_id: contract.id,
          meta: {
            room_id,
            overallRisk: analysis.overallRisk,
            redFlagCount: analysis.redFlags?.length || 0
          },
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        // Silent fail for audit
      }

      return Response.json({
        ok: true,
        mode: "ai_flow",
        contract,
        draft: draftContent,
        analysis,
        parties: {
          investor: investor?.full_name || investor?.email,
          agent: agent?.full_name || agent?.email
        }
      });
    }

    // MODE: TEMPLATE - Original template-based flow
    if (!room_id || !template_id || !terms) {
      return Response.json({ error: "room_id, template_id, terms required (or use mode: 'ai_flow')" }, { status: 400 });
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
      ...terms
    };

    const baseDoc = renderTemplate(template.body, enrichedTerms);

    // Return the rendered template directly (no AI polishing)
    const content = baseDoc;

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
      content,
      draft_url: null
    });
  } catch (error) {
    console.error('[contractGenerateDraft] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});