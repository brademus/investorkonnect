/**
 * Find Best Agents - Location-Based Matching
 * 
 * Simply finds agents that operate in the deal's State and County.
 * No complex AI scoring, just direct location matching.
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
    const { state, county, dealId } = body;
    const limit = 3; // Limit to 3 agents as requested

    console.log(`[findBestAgents] Matching for State: ${state}, County: ${county}, Deal: ${dealId}`);

    // Get ALL agents from the database (filtering in memory for flexibility with array fields)
    // Ideally, we'd use a database filter if the SDK supports array containment or OR queries efficiently
    const allProfiles = await base44.entities.Profile.filter({});
    
    const agents = allProfiles.filter(p => 
      p.user_role === 'agent' || 
      p.user_type === 'agent' ||
      p.agent // Has agent data object
    );
    
    // Filter agents by location
    const matchedAgents = agents.filter(agent => {
      const agentMarkets = [
        ...(agent.markets || []),
        ...(agent.agent?.markets || []),
        agent.target_state,
        agent.agent?.license_state
      ].map(m => m?.toLowerCase().trim()).filter(Boolean);

      const targetState = state?.toLowerCase().trim();
      const targetCounty = county?.toLowerCase().trim();

      // Check for State match
      const stateMatch = agentMarkets.some(m => m === targetState);
      
      // Check for County match (if county is provided)
      // We check if any of the agent's markets string includes the county name
      const countyMatch = targetCounty 
        ? agentMarkets.some(m => m.includes(targetCounty)) 
        : false;

      // Primary match: State MUST match. 
      // County match is a bonus that prioritizes, but we'll take state-level agents if needed.
      // For this "strict" matching request, we'll require at least a state match.
      return stateMatch;
    });

    // Sort by County match first, then random/others
    matchedAgents.sort((a, b) => {
       const aMarkets = [
        ...(a.markets || []),
        ...(a.agent?.markets || [])
      ].join(' ').toLowerCase();
       const bMarkets = [
        ...(b.markets || []),
        ...(b.agent?.markets || [])
      ].join(' ').toLowerCase();

      const targetCounty = county?.toLowerCase().trim();
      const aHasCounty = targetCounty && aMarkets.includes(targetCounty);
      const bHasCounty = targetCounty && bMarkets.includes(targetCounty);

      if (aHasCounty && !bHasCounty) return -1;
      if (!aHasCounty && bHasCounty) return 1;
      return 0;
    });

    // Take top 3
    const topAgents = matchedAgents.slice(0, limit);

    const results = topAgents.map(agent => ({
      profile: agent,
      score: 1.0, // Simple high score for location match
      reason: `Matches your deal's location: ${state}${county ? ', ' + county : ''}`,
      region: agent.target_state || agent.agent?.markets?.[0]
    }));

    // If no agents found, return empty list (UI will handle "No agents found")
    
    console.log('[findBestAgents] Returning', results.length, 'results');
    
    return Response.json({ 
      ok: true, 
      results,
      total: results.length,
      locationBased: true
    });
    
  } catch (error) {
    console.error('[findBestAgents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});