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
    
    // Normalize state helper
    const normalizeState = (s) => {
      if (!s) return null;
      s = s.toString().toLowerCase().trim();
      
      const states = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
        'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
        'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
        'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
        'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
        'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
        'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
        'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
        'district of columbia': 'DC'
      };
      
      // If it's a full name, return code. If it's code (length 2), return it.
      return states[s] || (s.length === 2 ? s.toUpperCase() : null);
    };

    const targetStateCode = normalizeState(state);
    
    if (!targetStateCode) {
      console.log('[findBestAgents] No valid target state provided. Returning empty.');
      return Response.json({ ok: true, results: [], total: 0 });
    }

    // Filter agents by location - STRICT STATE MATCH ONLY
    const matchedAgents = agents.filter(agent => {
      const agentMarkets = [
        ...(agent.markets || []),
        ...(agent.agent?.markets || []),
        agent.target_state,
        agent.agent?.license_state,
        ...(agent.agent?.licensed_states || [])
      ].map(m => normalizeState(m)).filter(Boolean); // Normalize all agent markets to codes

      const targetCounty = county?.toLowerCase().trim();

      // Check for State match (Strict equality on normalized codes)
      const stateMatch = agentMarkets.includes(targetStateCode);
      
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