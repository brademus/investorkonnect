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
    
    // ========== BUY BOX (Critical for matching) ==========
    const inv = profile.investor || {};
    if (inv.buy_box) {
      const bb = inv.buy_box;
      if (bb.asset_types?.length) parts.push(`Property Types: ${bb.asset_types.join(', ')}`);
      if (bb.markets?.length) parts.push(`Target Markets: ${bb.markets.join(', ')}`);
      if (bb.min_budget || bb.max_budget) parts.push(`Budget: $${bb.min_budget || 0} - $${bb.max_budget || 'unlimited'}`);
      if (bb.cap_rate_min) parts.push(`Min Cap Rate: ${bb.cap_rate_min}%`);
      if (bb.coc_min) parts.push(`Min Cash on Cash: ${bb.coc_min}%`);
      if (bb.deal_profile?.length) parts.push(`Deal Profile: ${bb.deal_profile.join(', ')}`);
      if (bb.deal_stage) parts.push(`Deal Stage: ${bb.deal_stage}`);
      if (bb.deployment_timeline) parts.push(`Deployment Timeline: ${bb.deployment_timeline}`);
    }
    
    // ========== DEEP ONBOARDING METADATA (8-step) ==========
    const meta = profile.metadata || {};
    
    // Basic Profile
    if (meta.basicProfile) {
      const bp = meta.basicProfile;
      if (bp.investor_description) parts.push(`Investor Type: ${bp.investor_description}`);
      if (bp.deals_closed_24mo) parts.push(`Deals Closed (24mo): ${bp.deals_closed_24mo}`);
      if (bp.typical_deal_size) parts.push(`Typical Deal Size: ${bp.typical_deal_size}`);
    }
    
    // Capital & Financing
    if (meta.capitalFinancing) {
      const cf = meta.capitalFinancing;
      if (cf.capital_available_12mo) parts.push(`Capital Available: ${cf.capital_available_12mo}`);
      if (cf.financing_methods?.length) parts.push(`Financing Methods: ${cf.financing_methods.join(', ')}`);
      if (cf.financing_lined_up) parts.push(`Financing Ready: ${cf.financing_lined_up}`);
    }
    
    // Strategy & Deals
    if (meta.strategyDeals) {
      const sd = meta.strategyDeals;
      if (sd.primary_strategy) parts.push(`Primary Strategy: ${sd.primary_strategy}`);
      if (sd.investment_strategies?.length) parts.push(`Strategies: ${sd.investment_strategies.join(', ')}`);
      if (sd.property_types?.length) parts.push(`Property Types Wanted: ${sd.property_types.join(', ')}`);
      if (sd.property_condition) parts.push(`Condition Preference: ${sd.property_condition}`);
    }
    
    // Target Markets
    if (meta.targetMarkets) {
      const tm = meta.targetMarkets;
      if (tm.primary_state) parts.push(`Primary State: ${tm.primary_state}`);
      if (tm.specific_cities_counties) parts.push(`Specific Areas: ${tm.specific_cities_counties}`);
      if (tm.state_price_min || tm.state_price_max) parts.push(`Price Range: $${tm.state_price_min || 0} - $${tm.state_price_max || 'unlimited'}`);
    }
    
    // Deal Structure
    if (meta.dealStructure) {
      const ds = meta.dealStructure;
      if (ds.deal_types_open_to?.length) parts.push(`Deal Types: ${ds.deal_types_open_to.join(', ')}`);
      if (ds.most_important_now) parts.push(`Priority: ${ds.most_important_now}`);
      if (ds.target_hold_period) parts.push(`Hold Period: ${ds.target_hold_period}`);
    }
    
    // Risk & Speed
    if (meta.riskSpeed) {
      const rs = meta.riskSpeed;
      if (rs.decision_speed_on_deal) parts.push(`Decision Speed: ${rs.decision_speed_on_deal}`);
      if (rs.comfortable_non_refundable_em) parts.push(`Non-Refundable EM: ${rs.comfortable_non_refundable_em}`);
    }
    
    // Agent Working Preferences
    if (meta.agentWorking) {
      const aw = meta.agentWorking;
      if (aw.what_from_agent?.length) parts.push(`Wants From Agent: ${aw.what_from_agent.join(', ')}`);
      if (aw.communication_preferences?.length) parts.push(`Comm Preferences: ${aw.communication_preferences.join(', ')}`);
      if (aw.preferred_agent_response_time) parts.push(`Response Time Pref: ${aw.preferred_agent_response_time}`);
      if (aw.agent_deal_breakers) parts.push(`Deal Breakers: ${aw.agent_deal_breakers}`);
    }
    
    // Experience & Accreditation
    if (meta.experienceAccreditation) {
      const ea = meta.experienceAccreditation;
      if (ea.accredited_investor) parts.push(`Accredited: ${ea.accredited_investor}`);
      if (ea.investment_holding_structures?.length) parts.push(`Holding Structures: ${ea.investment_holding_structures.join(', ')}`);
    }
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
  
  const a = agent.agent || {};
  
  // Basic info
  if (a.markets?.length) parts.push(`Service Areas: ${a.markets.join(', ')}`);
  if (a.brokerage) parts.push(`Brokerage: ${a.brokerage}`);
  if (a.license_state) parts.push(`Licensed In: ${a.license_state}`);
  if (a.is_full_time_agent) parts.push(`Full-Time Agent: Yes`);
  
  // Experience
  if (a.experience_years) parts.push(`Experience: ${a.experience_years} years`);
  if (a.investor_experience_years) parts.push(`Investor Experience: ${a.investor_experience_years} years`);
  if (a.investor_clients_count) parts.push(`Investor Clients Served: ${a.investor_clients_count}`);
  if (a.investment_deals_last_12m) parts.push(`Deals Last 12mo: ${a.investment_deals_last_12m}`);
  
  // Specialties & strategies
  if (a.specialties?.length) parts.push(`Property Specialties: ${a.specialties.join(', ')}`);
  if (a.investment_strategies?.length) parts.push(`Investment Strategies: ${a.investment_strategies.join(', ')}`);
  if (a.investor_types_served?.length) parts.push(`Investor Types: ${a.investor_types_served.join(', ')}`);
  if (a.typical_deal_price_range) parts.push(`Typical Price Range: ${a.typical_deal_price_range}`);
  
  // Deal sourcing
  if (a.sources_off_market) parts.push(`Sources Off-Market: Yes`);
  if (a.deal_sourcing_methods?.length) parts.push(`Sourcing Methods: ${a.deal_sourcing_methods.join(', ')}`);
  
  // Network & references
  if (a.pro_network_types?.length) parts.push(`Professional Network: ${a.pro_network_types.join(', ')}`);
  if (a.can_refer_professionals) parts.push(`Can Refer Pros: Yes`);
  if (a.can_provide_investor_references) parts.push(`Has References: Yes`);
  
  // Communication
  if (a.preferred_communication_channels?.length) parts.push(`Communication: ${a.preferred_communication_channels.join(', ')}`);
  if (a.typical_response_time) parts.push(`Response Time: ${a.typical_response_time}`);
  if (a.languages_spoken?.length) parts.push(`Languages: ${a.languages_spoken.join(', ')}`);
  
  // Personal investing
  if (a.personally_invests) parts.push(`Personally Invests: Yes`);
  
  // Bio and differentiators
  if (a.what_sets_you_apart) parts.push(`What Sets Apart: ${a.what_sets_you_apart}`);
  if (a.bio) parts.push(`Bio: ${a.bio.substring(0, 300)}`);
  
  if (a.verification_status === 'verified') parts.push(`Status: Verified`);
  
  return parts.length > 0 ? parts.join('\n') : 'Real estate agent';
}