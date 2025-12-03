/**
 * Find Best Agents - AI-Powered Agent Matching
 * 
 * Uses LLM to intelligently match investors with agents based on ANY available profile data.
 * Works even when embeddings don't exist or profile is incomplete.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit || 6), 20));
    
    // Get investor profile
    let investorProfile = null;
    if (body.investorProfileId) {
      const profiles = await base44.entities.Profile.filter({ id: body.investorProfileId });
      investorProfile = profiles[0];
    } else {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      investorProfile = profiles[0];
    }
    
    console.log('[findBestAgents] Investor profile:', investorProfile?.id);
    
    // Build investor summary from ALL available data
    const investorSummary = buildInvestorSummary(investorProfile, body.dealSubmission);
    console.log('[findBestAgents] Investor summary:', investorSummary.substring(0, 200));
    
    // Get ALL agents from the database
    const allProfiles = await base44.entities.Profile.filter({});
    
    // Find agents - check multiple fields
    const agents = allProfiles.filter(p => 
      p.user_role === 'agent' || 
      p.user_type === 'agent' ||
      p.agent // Has agent data object
    );
    
    console.log('[findBestAgents] Found', agents.length, 'total agents');
    
    if (agents.length === 0) {
      return Response.json({ 
        ok: true, 
        results: [], 
        total: 0,
        message: 'No agents available yet'
      });
    }
    
    // Build agent summaries
    const agentSummaries = agents.map(agent => ({
      id: agent.id,
      summary: buildAgentSummary(agent)
    }));
    
    // Use LLM to find best matches
    const prompt = `You are an AI matchmaking assistant for a real estate investment platform.

INVESTOR PROFILE:
${investorSummary}

AVAILABLE AGENTS (${agents.length} total):
${agentSummaries.map((a, i) => `
Agent #${i + 1} (ID: ${a.id}):
${a.summary}
`).join('\n---\n')}

TASK: Analyze the investor's needs and rank the top ${limit} agents that would be the BEST match.

Consider:
- Geographic overlap (same state/market)
- Investment strategy alignment
- Experience level
- Property type expertise
- Any other relevant factors

Return a JSON array of the best agent IDs with match scores and reasons.
Format: [{"id": "agent_id", "score": 0.0-1.0, "reason": "Brief reason"}]

Only include agents that are at least somewhat relevant. If an agent has no relevant data, give them a lower score.
RESPOND ONLY WITH THE JSON ARRAY, no other text.`;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                score: { type: "number" },
                reason: { type: "string" }
              }
            }
          }
        }
      }
    });
    
    console.log('[findBestAgents] LLM response:', JSON.stringify(llmResponse).substring(0, 500));
    
    // Parse LLM response
    let matches = [];
    if (llmResponse?.matches) {
      matches = llmResponse.matches;
    } else if (Array.isArray(llmResponse)) {
      matches = llmResponse;
    }
    
    // Build results with full profile data
    const agentMap = new Map(agents.map(a => [a.id, a]));
    const results = matches
      .filter(m => agentMap.has(m.id))
      .slice(0, limit)
      .map(m => ({
        profile: agentMap.get(m.id),
        score: m.score || 0.7,
        reason: m.reason || 'AI-matched based on your profile',
        region: agentMap.get(m.id)?.target_state || agentMap.get(m.id)?.agent?.markets?.[0] || null
      }));
    
    // If LLM didn't return enough results, add remaining agents with lower scores
    if (results.length < limit) {
      const matchedIds = new Set(results.map(r => r.profile.id));
      const remaining = agents
        .filter(a => !matchedIds.has(a.id))
        .slice(0, limit - results.length)
        .map(a => ({
          profile: a,
          score: 0.5,
          reason: 'Available agent in your area',
          region: a.target_state || a.agent?.markets?.[0] || null
        }));
      results.push(...remaining);
    }
    
    console.log('[findBestAgents] Returning', results.length, 'results');
    
    return Response.json({ 
      ok: true, 
      results,
      total: agents.length,
      aiPowered: true
    });
    
  } catch (error) {
    console.error('[findBestAgents] Error:', error);
    
    // Fallback: return any available agents
    try {
      const base44 = createClientFromRequest(req);
      const allProfiles = await base44.entities.Profile.filter({});
      const agents = allProfiles.filter(p => 
        p.user_role === 'agent' || p.user_type === 'agent' || p.agent
      );
      
      const fallbackResults = agents.slice(0, 6).map(a => ({
        profile: a,
        score: 0.6,
        reason: 'Available agent',
        region: a.target_state || a.agent?.markets?.[0] || null
      }));
      
      return Response.json({ 
        ok: true, 
        results: fallbackResults,
        total: agents.length,
        fallback: true
      });
    } catch (fallbackErr) {
      return Response.json({ 
        error: error.message || 'Failed to find agents' 
      }, { status: 500 });
    }
  }
});

function buildInvestorSummary(profile, dealSubmission) {
  const parts = [];
  
  if (profile) {
    if (profile.full_name) parts.push(`Name: ${profile.full_name}`);
    if (profile.target_state) parts.push(`Target State: ${profile.target_state}`);
    if (profile.markets?.length) parts.push(`Markets: ${profile.markets.join(', ')}`);
    if (profile.goals) parts.push(`Goals: ${profile.goals}`);
    
    // Investor-specific data
    const inv = profile.investor || {};
    if (inv.buy_box) {
      const bb = inv.buy_box;
      if (bb.asset_types?.length) parts.push(`Property Types: ${bb.asset_types.join(', ')}`);
      if (bb.markets?.length) parts.push(`Target Markets: ${bb.markets.join(', ')}`);
      if (bb.min_budget || bb.max_budget) parts.push(`Budget: $${bb.min_budget || 0} - $${bb.max_budget || 'unlimited'}`);
      if (bb.investment_strategies?.length) parts.push(`Strategies: ${bb.investment_strategies.join(', ')}`);
    }
    
    // Onboarding/metadata
    const meta = profile.metadata || profile.onboarding || {};
    if (meta.investment_experience) parts.push(`Experience: ${meta.investment_experience}`);
    if (meta.capital_ready) parts.push(`Capital Ready: ${meta.capital_ready}`);
  }
  
  // Deal submission data
  if (dealSubmission) {
    if (dealSubmission.state) parts.push(`Deal State: ${dealSubmission.state}`);
    if (dealSubmission.propertyType) parts.push(`Property Type: ${dealSubmission.propertyType}`);
    if (dealSubmission.investmentStrategy) parts.push(`Strategy: ${dealSubmission.investmentStrategy}`);
    if (dealSubmission.totalBudget) parts.push(`Budget: ${dealSubmission.totalBudget}`);
    if (dealSubmission.timeline) parts.push(`Timeline: ${dealSubmission.timeline}`);
  }
  
  return parts.length > 0 ? parts.join('\n') : 'New investor looking for real estate opportunities';
}

function buildAgentSummary(agent) {
  const parts = [];
  
  if (agent.full_name) parts.push(`Name: ${agent.full_name}`);
  if (agent.target_state) parts.push(`Primary State: ${agent.target_state}`);
  if (agent.markets?.length) parts.push(`Markets: ${agent.markets.join(', ')}`);
  
  const agentData = agent.agent || {};
  if (agentData.markets?.length) parts.push(`Service Areas: ${agentData.markets.join(', ')}`);
  if (agentData.specialties?.length) parts.push(`Specialties: ${agentData.specialties.join(', ')}`);
  if (agentData.experience_years) parts.push(`Experience: ${agentData.experience_years} years`);
  if (agentData.investor_experience_years) parts.push(`Investor Experience: ${agentData.investor_experience_years} years`);
  if (agentData.investment_strategies?.length) parts.push(`Investment Strategies: ${agentData.investment_strategies.join(', ')}`);
  if (agentData.investor_friendly) parts.push(`Investor Friendly: Yes`);
  if (agentData.brokerage) parts.push(`Brokerage: ${agentData.brokerage}`);
  if (agentData.bio) parts.push(`Bio: ${agentData.bio.substring(0, 200)}`);
  if (agentData.verification_status === 'verified') parts.push(`Status: Verified`);
  
  return parts.length > 0 ? parts.join('\n') : 'Real estate agent';
}