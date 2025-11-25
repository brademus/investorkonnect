import OpenAI from "npm:openai@4.75.0";

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
  }
  return client;
}

// OpenAI Stored Prompt IDs
const CONTRACT_DRAFTING_PROMPT_ID = "pmpt_69251e14fe2081978cbce9e8eeb35eb6061bb00e8b46b159";
const CONTRACT_ANALYSIS_PROMPT_ID = "pmpt_69251b41d54c81909c072edf566f67ce0447ce55c0cd42b6";
const PREDICTIVE_MATCHING_PROMPT_ID = "pmpt_692522a97a9c81958b347a6d6e4a1fa20fac2ca0ae147b81";

/**
 * Generate contract draft from conversation using OpenAI Responses API
 * Prompt ID: pmpt_69251e14fe2081978cbce9e8eeb35eb6061bb00e8b46b159
 * Variable: conversation_text
 */
export async function generateDraftWithPrompt(conversationText, context = {}) {
  const oai = getClient();
  
  try {
    // Try OpenAI Responses API with stored prompt
    const response = await oai.responses.create({
      model: "gpt-4o",
      prompt: CONTRACT_DRAFTING_PROMPT_ID,
      input: {
        conversation_text: conversationText
      },
      temperature: 0.2
    });
    
    return response.output_text || response.choices?.[0]?.message?.content || "";
  } catch (promptError) {
    // Fallback to direct completion
    return await generateDraftDirect(conversationText, context);
  }
}

/**
 * Fallback: Generate draft using direct GPT-4o call
 */
async function generateDraftDirect(conversationText, context = {}) {
  const oai = getClient();
  
  const systemPrompt = `You are a legal contract drafter for AgentVault, a real estate investment platform.
Analyze the conversation transcript and generate a professional contract draft.

Extract:
- Party names and roles (investor, agent)
- Property/market details
- Fee structures and payment terms
- Timeline and exclusivity
- Any special conditions discussed

Output a complete, professional contract in Markdown format with:
- Clear section headers
- All negotiated terms filled in
- Standard legal protections
- Placeholder markers <<FIELD>> for any missing information`;

  const resp = await oai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate a contract draft from this Deal Room conversation:\n\n${conversationText}` }
    ],
    temperature: 0.2,
    max_tokens: 4000
  });
  
  return resp.choices?.[0]?.message?.content || "";
}

/**
 * Analyze contract using OpenAI Responses API with stored Prompt ID
 * Prompt ID: pmpt_69251b41d54c81909c072edf566f67ce0447ce55c0cd42b6
 * Variable: contract_text
 */
export async function analyzeContractWithPrompt(contractText, additionalContext = {}) {
  const oai = getClient();
  
  try {
    // Call OpenAI Responses API with stored prompt
    const response = await oai.responses.create({
      model: "gpt-4o",
      prompt: CONTRACT_ANALYSIS_PROMPT_ID,
      input: {
        contract_text: contractText
      },
      temperature: 0.1
    });
    
    const content = response.output_text || response.choices?.[0]?.message?.content || "{}";
    
    try {
      return JSON.parse(content);
    } catch {
      return { raw_analysis: content };
    }
  } catch (promptError) {
    // Fallback to direct completion if Responses API unavailable
    return await analyzeContractDirect(contractText, additionalContext);
  }
}

/**
 * Direct contract analysis fallback using GPT-4o
 */
async function analyzeContractDirect(contractText, context = {}) {
  const oai = getClient();
  
  const systemPrompt = `You are Contract Guardian, an expert real estate contract analyst for AgentVault.
Your role is to analyze contracts for potential risks, unfair clauses, and investor protections.

Analyze the contract and provide:
1. Overall risk assessment (Low/Medium/High)
2. Clause-by-clause risk analysis
3. Red flags that require immediate attention
4. Specific recommendations for safer alternatives
5. Missing protections that should be added

Consider the investor's risk profile if provided. Be thorough but concise.

Output JSON format:
{
  "overallRisk": "Medium",
  "summary": "Brief summary of the contract and key concerns",
  "clauses": [
    {
      "section": "Section name",
      "originalText": "The problematic text",
      "risk": "High/Medium/Low",
      "concern": "Why this is concerning",
      "suggestion": "Safer alternative language",
      "priority": 1
    }
  ],
  "redFlags": ["Critical issues"],
  "missingProtections": ["Protections that should be added"],
  "recommendations": ["Actionable next steps"],
  "negotiationPoints": ["Key points to negotiate"]
}`;

  const userPrompt = `Contract to analyze:

${contractText}

${context.riskProfile ? `
Investor Risk Profile:
- Risk Tolerance: ${context.riskProfile.riskTolerance || 'moderate'}
- Experience: ${context.riskProfile.experience || 'intermediate'}
- Strategies: ${context.riskProfile.strategies?.join(', ') || 'not specified'}
- Concerns: ${context.riskProfile.concerns?.join(', ') || 'standard investor protections'}
` : ''}

Provide comprehensive analysis.`;

  const resp = await oai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1,
    max_tokens: 4000
  });
  
  const txt = resp.choices?.[0]?.message?.content || "{}";
  try { 
    return JSON.parse(txt); 
  } catch { 
    return { error: "Failed to parse analysis", raw: txt }; 
  }
}

export async function completeJSON(system, user, model = "gpt-4o") {
  const oai = getClient();
  const resp = await oai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.2,
    max_tokens: 2000
  });
  const txt = resp.choices?.[0]?.message?.content || "{}";
  try { 
    return JSON.parse(txt); 
  } catch { 
    return {}; 
  }
}

export async function completeText(system, user, model = "gpt-4o") {
  const oai = getClient();
  const resp = await oai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.3,
    max_tokens: 3000
  });
  return resp.choices?.[0]?.message?.content || "";
}

/**
 * Generate contract draft with high accuracy
 */
/**
 * Predictive Match Scoring using OpenAI Responses API
 * Prompt ID: pmpt_692522a97a9c81958b347a6d6e4a1fa20fac2ca0ae147b81
 * Variables: investor_profile, target_market, agents_json
 */
export async function predictiveMatchWithPrompt(investorProfile, targetMarket, agentsJson) {
  const oai = getClient();
  
  try {
    // Call OpenAI Responses API with stored prompt
    const response = await oai.responses.create({
      model: "gpt-4o",
      prompt: PREDICTIVE_MATCHING_PROMPT_ID,
      input: {
        investor_profile: typeof investorProfile === 'string' ? investorProfile : JSON.stringify(investorProfile),
        target_market: targetMarket,
        agents_json: typeof agentsJson === 'string' ? agentsJson : JSON.stringify(agentsJson)
      },
      temperature: 0.2
    });
    
    const content = response.output_text || response.choices?.[0]?.message?.content || "{}";
    
    try {
      return JSON.parse(content);
    } catch {
      return { raw_response: content };
    }
  } catch (promptError) {
    // Fallback to direct completion
    return await predictiveMatchDirect(investorProfile, targetMarket, agentsJson);
  }
}

/**
 * Fallback: Predictive matching using direct GPT-4o call
 */
async function predictiveMatchDirect(investorProfile, targetMarket, agentsJson) {
  const oai = getClient();
  
  const systemPrompt = `You are an expert real estate investor-agent matching system for AgentVault.
Your task is to analyze an investor's profile and match them with the best agents from a list.

Evaluate each agent based on:
1. Market expertise alignment (experience in investor's target market)
2. Strategy compatibility (agent's specialties vs investor's investment strategy)
3. Experience level match (agent experience appropriate for investor's needs)
4. Communication style fit
5. Track record with similar investors
6. Deal volume and success rate

For each agent, provide:
- matchScore (0-100): Overall compatibility score
- trustScore (0-100): Reliability and verification score
- dealLikelihood (0-100): Probability of successful transaction
- strengths: Array of why this agent is a good match
- concerns: Array of potential issues or gaps
- recommendation: Brief recommendation text

Output JSON format:
{
  "matches": [
    {
      "agentId": "agent_profile_id",
      "matchScore": 85,
      "trustScore": 90,
      "dealLikelihood": 75,
      "strengths": ["Deep Phoenix market knowledge", "10+ investor clients"],
      "concerns": ["Higher commission rate"],
      "recommendation": "Strong match for your STR strategy in Phoenix"
    }
  ],
  "topRecommendation": "agent_id_of_best_match",
  "summary": "Brief summary of matching results"
}`;

  const userPrompt = `Investor Profile:
${typeof investorProfile === 'string' ? investorProfile : JSON.stringify(investorProfile, null, 2)}

Target Market: ${targetMarket}

Available Agents:
${typeof agentsJson === 'string' ? agentsJson : JSON.stringify(agentsJson, null, 2)}

Analyze and rank these agents for this investor.`;

  const resp = await oai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 4000
  });
  
  const txt = resp.choices?.[0]?.message?.content || "{}";
  try { 
    return JSON.parse(txt); 
  } catch { 
    return { error: "Failed to parse matching results", raw: txt }; 
  }
}

export async function generateContractDraft(templateBody, terms, dealContext = {}) {
  const oai = getClient();
  
  const systemPrompt = `You are a legal contract drafter for real estate transactions.
Given a template and deal terms, generate a professional, legally sound contract.
- Fill in all placeholders with provided terms
- Improve clarity and grammar
- Ensure all standard protections are included
- Mark any missing information with <<FIELD_NAME>>
- Output clean, professional contract text in Markdown format`;

  const userPrompt = `Template:
${templateBody}

Terms:
${JSON.stringify(terms, null, 2)}

Deal Context:
${JSON.stringify(dealContext, null, 2)}

Generate the complete contract.`;

  const resp = await oai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 4000
  });
  
  return resp.choices?.[0]?.message?.content || "";
}