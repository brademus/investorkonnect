import OpenAI from "npm:openai@4.75.0";

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
  }
  return client;
}

// Contract Guardian Prompt ID for high-stakes legal analysis
const CONTRACT_GUARDIAN_PROMPT_ID = "pmpt_69251b41d54c81909c072edf566f67ce0447ce55c0cd42b6";

/**
 * Analyze contract using OpenAI Responses API with stored Prompt ID
 * Uses GPT-4o for maximum accuracy on legal analysis
 */
export async function analyzeContractWithPrompt(contractText, additionalContext = {}) {
  const oai = getClient();
  
  try {
    // Call OpenAI Responses API with stored prompt
    const response = await oai.responses.create({
      model: "gpt-4o",
      prompt: CONTRACT_GUARDIAN_PROMPT_ID,
      input: {
        contract_text: contractText,
        ...additionalContext
      },
      temperature: 0.1 // Low temperature for consistent legal analysis
    });
    
    const content = response.output_text || response.choices?.[0]?.message?.content || "{}";
    
    try {
      return JSON.parse(content);
    } catch {
      return { raw_analysis: content };
    }
  } catch (promptError) {
    // Fallback to direct completion if Responses API unavailable
    console.log("[openaiContractsClient] Falling back to direct completion");
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