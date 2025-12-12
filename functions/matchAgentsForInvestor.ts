/**
 * Match Agents for Investor Function
 * 
 * Finds best agent matches for an investor using cosine similarity
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { cosineSim } from './lib/cosine.js';

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
    const limit = Math.max(1, Math.min(Number(body.limit || 10), 50));
    const county = body.county || null;
    
    // Get investor profile ID
    let investorProfileId = body.investorProfileId;
    if (!investorProfileId) {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      investorProfileId = profiles[0]?.id;
    }
    
    if (!investorProfileId) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }
    
    console.log('[matchAgentsForInvestor] Finding matches for investor:', investorProfileId, 'Version: 1.3');
    
    // Get investor profile for matching context
    const investorProfiles = await base44.entities.Profile.filter({ id: investorProfileId });
    const investorProfile = investorProfiles[0];
    // Prioritize state from request body (deal location), then profile target
    const investorRegion = body.state || investorProfile?.target_state || investorProfile?.markets?.[0] || null;
    
    console.log('[matchAgentsForInvestor] Match region:', investorRegion, '(Source: ' + (body.state ? 'Deal' : 'Profile') + ')');
    
    // SIMPLIFIED MATCHING LOGIC
    // If state is provided (from deal context), ONLY match by state.
    // This overrides complex vector/embedding logic to ensure predictable results.
    if (body.state) {
      console.log('[matchAgentsForInvestor] Using strict state matching for:', body.state);
      
      // Normalize target state (handle names like "Arizona" -> "AZ" mapping if needed, but keeping simple for now)
      const targetState = body.state.trim().toUpperCase(); 
      
      // State Name Map (Comprehensive)
      const stateMap = {
        'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
        'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
        'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
        'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
        'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
        'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
        'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
        'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
        'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
        'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
      };

      // Create reverse map (Code -> Name)
      const codeToName = Object.entries(stateMap).reduce((acc, [name, code]) => {
        acc[code] = name;
        return acc;
      }, {});
      
      // Determine both Code and Name for the target state
      let targetCode = null;
      let targetName = null;

      if (stateMap[targetState]) {
        // Input is Name (e.g. WISCONSIN)
        targetName = targetState;
        targetCode = stateMap[targetState];
      } else if (codeToName[targetState]) {
        // Input is Code (e.g. WI)
        targetCode = targetState;
        targetName = codeToName[targetState];
      } else {
        // Input matches neither exactly, assume Code if len=2, else Name
        if (targetState.length === 2) targetCode = targetState;
        else targetName = targetState;
      }

      console.log(`[matchAgentsForInvestor] Matching against: Code=${targetCode}, Name=${targetName}`);
      
      // TARGETED SEARCH STRATEGY (v1.3)
      // Instead of fetching all profiles (which hits limits), we query specifically for this state
      
      const queries = [];
      const limits = 50;

      // 1. Direct match on target_state
      if (targetCode) queries.push(base44.entities.Profile.filter({ target_state: targetCode }, '-created_date', limits));
      if (targetName) queries.push(base44.entities.Profile.filter({ target_state: targetName }, '-created_date', limits));

      // 2. Direct match on agent.license_state
      if (targetCode) {
         try {
             // Attempt to filter by nested field if supported
             queries.push(base44.entities.Profile.filter({ 'agent.license_state': targetCode }, '-created_date', limits));
         } catch(e) { console.log('Nested filter failed, skipping'); }
      }
      
      // 3. Match on user_role='agent' (catch-all for recent agents)
      queries.push(base44.entities.Profile.filter({ user_role: 'agent' }, '-created_date', 100));

      // Execute all queries in parallel
      const queryResults = await Promise.all(queries);
      
      // Combine and Dedup
      const allFound = queryResults.flat();
      const seenIds = new Set();
      const allAgents = [];
      
      for (const p of allFound) {
          if (!p || seenIds.has(p.id)) continue;
          if (p.user_role === 'agent' || (p.agent && Object.keys(p.agent).length > 0)) {
              seenIds.add(p.id);
              allAgents.push(p);
          }
      }

      console.log(`[matchAgentsForInvestor] Aggregated ${allAgents.length} potential agents for matching`);
      
      // First, filter by state
      let matchedAgents = allAgents.filter(agent => {
        const locations = [
          agent.target_state,
          agent.license_state,
          ...(agent.markets || []),
          agent.agent?.license_state,
          ...(agent.agent?.licensed_states || []),
          ...(agent.agent?.markets || [])
        ].filter(Boolean).map(s => s.trim().toUpperCase());
        
        return locations.some(loc => {
           if (targetCode && loc === targetCode) return true;
           if (targetName && loc === targetName) return true;
           if (targetName && loc.includes(targetName)) return true;
           if (targetCode && loc.length === 2 && loc === targetCode) return true;
           return false;
        });
      });
      
      console.log(`[matchAgentsForInvestor] State match: ${matchedAgents.length} agents`);
      
      // County-aware ranking
      let countyMatches = [];
      let stateOnlyMatches = [];
      
      if (county && matchedAgents.length > 0) {
        const countyUpper = county.trim().toUpperCase();
        
        // Separate county matches from state-only matches
        matchedAgents.forEach(agent => {
          const counties = [
            ...(agent.agent?.counties || []),
            ...(agent.agent?.service_counties || []),
            ...(agent.agent?.primary_neighborhoods_notes || '').split(',').map(s => s.trim()),
            agent.agent?.location,
            agent.location
          ].filter(Boolean).map(c => c.trim().toUpperCase());
          
          const isCountyMatch = counties.some(c => 
            c.includes(countyUpper) || 
            countyUpper.includes(c) ||
            c.split(' ').some(word => word === countyUpper)
          );
          
          if (isCountyMatch) {
            countyMatches.push({ ...agent, _countyScore: 1.0 });
          } else {
            stateOnlyMatches.push({ ...agent, _countyScore: 0.7 });
          }
        });
        
        console.log(`[matchAgentsForInvestor] County-aware split: ${countyMatches.length} county matches, ${stateOnlyMatches.length} state-only`);
        
        // Sort county matches first (verified + experience)
        countyMatches.sort((a, b) => {
          const verA = a.agent?.verification_status === 'verified' ? 1 : 0;
          const verB = b.agent?.verification_status === 'verified' ? 1 : 0;
          if (verA !== verB) return verB - verA;
          return (b.agent?.experience_years || 0) - (a.agent?.experience_years || 0);
        });
        
        // Sort state-only matches
        stateOnlyMatches.sort((a, b) => {
          const verA = a.agent?.verification_status === 'verified' ? 1 : 0;
          const verB = b.agent?.verification_status === 'verified' ? 1 : 0;
          if (verA !== verB) return verB - verA;
          return (b.agent?.experience_years || 0) - (a.agent?.experience_years || 0);
        });
        
        // Combine: county first, then fill remaining slots with state-only
        const neededFromState = Math.max(0, limit - countyMatches.length);
        matchedAgents = [...countyMatches, ...stateOnlyMatches.slice(0, neededFromState)];
        
        console.log(`[matchAgentsForInvestor] Final mix: ${countyMatches.length} county + ${Math.min(neededFromState, stateOnlyMatches.length)} state-only`);
      } else {
        // No county provided, sort by verification + experience only
        matchedAgents.sort((a, b) => {
          const verA = a.agent?.verification_status === 'verified' ? 1 : 0;
          const verB = b.agent?.verification_status === 'verified' ? 1 : 0;
          if (verA !== verB) return verB - verA;
          return (b.agent?.experience_years || 0) - (a.agent?.experience_years || 0);
        });
        matchedAgents = matchedAgents.map(a => ({ ...a, _countyScore: 0.8 }));
      }
      
      console.log(`[matchAgentsForInvestor] Found ${matchedAgents.length} agents in ${targetState}${county ? ` (${county} county-aware)` : ''}`);
      
      // Return top N with scores
      const results = matchedAgents.slice(0, limit).map(agent => ({
        profile: agent,
        score: agent._countyScore || 0.8,
        reason: agent._countyScore === 1.0 
          ? `Serves ${county} County, ${targetState}` 
          : `Licensed in ${targetState}`,
        region: targetState
      }));
      
      return Response.json({ ok: true, results, total: matchedAgents.length });
    }

    // --- OLD LOGIC BELOW (Only used if no state provided) ---

    // Load investor vector (may not exist for incomplete profiles)
    const invVectors = await base44.entities.ProfileVector.filter({ 
      profile_id: investorProfileId 
    });
    const invPV = invVectors[0];
    const hasEmbedding = invPV?.embedding && Array.isArray(invPV.embedding) && invPV.embedding.length > 0;
    
    console.log('[matchAgentsForInvestor] Has embedding:', hasEmbedding);
    
    let results = [];
    
    if (hasEmbedding) {
      // Use embedding-based matching
      console.log('[matchAgentsForInvestor] Using embedding-based matching');
      
      // Get candidate agents (same region first, then all)
      let candidates = await base44.entities.ProfileVector.filter({ 
        role: 'agent',
        ...(invPV.region ? { region: invPV.region } : {})
      });
      
      console.log('[matchAgentsForInvestor] Found', candidates.length, 'agents in region');
      
      // Fallback to all agents if no regional matches
      if (candidates.length === 0) {
        console.log('[matchAgentsForInvestor] No regional matches, loading all agents');
        candidates = await base44.entities.ProfileVector.filter({ role: 'agent' });
        console.log('[matchAgentsForInvestor] Found', candidates.length, 'total agents');
      }
      
      // If still no candidates with embeddings, fall back to profile-based matching
      if (candidates.length === 0) {
        console.log('[matchAgentsForInvestor] No agent embeddings found, falling back to profile matching');
        const allAgents = await base44.entities.Profile.filter({ user_role: 'agent' });
        
        if (allAgents.length > 0) {
          // Sort and return top agents
          allAgents.sort((a, b) => {
            const verA = a.agent?.verification_status === 'verified' ? 1 : 0;
            const verB = b.agent?.verification_status === 'verified' ? 1 : 0;
            if (verA !== verB) return verB - verA;
            return (b.agent?.experience_years || 0) - (a.agent?.experience_years || 0);
          });
          
          results = allAgents.slice(0, limit).map(agent => ({
            profile: agent,
            score: 0.6,
            region: agent.target_state || agent.agent?.markets?.[0] || null
          }));
          
          console.log('[matchAgentsForInvestor] Returning', results.length, 'fallback results');
          return Response.json({ ok: true, results, total: allAgents.length });
        }
      }
      
      // Calculate similarity scores
      const scored = candidates
        .filter(a => Array.isArray(a.embedding) && a.embedding.length > 0)
        .map(a => ({
          profile_id: a.profile_id,
          score: cosineSim(invPV.embedding, a.embedding),
          region: a.region
        }));
      
      // Sort by score descending
      scored.sort((x, y) => y.score - x.score);
      
      // Take top N
      const top = scored.slice(0, limit);
      
      console.log('[matchAgentsForInvestor] Top', top.length, 'matches calculated');
      
      // Load full profile data
      const profiles = await base44.entities.Profile.filter({});
      const profilesMap = new Map(profiles.map(p => [p.id, p]));
      
      // Build results with full profile data
      results = top.map(t => ({
        profile: profilesMap.get(t.profile_id) || { id: t.profile_id },
        score: t.score,
        region: t.region
      }));
    } else {
      // Fallback: simple region-based matching for incomplete profiles
      console.log('[matchAgentsForInvestor] Using region-based fallback matching');
      
      // Get all agent profiles
      const allAgents = await base44.entities.Profile.filter({ user_role: 'agent' });
      console.log('[matchAgentsForInvestor] Found', allAgents.length, 'total agents');
      
      // If no agents with user_role, try broader search
      let matchedAgents = allAgents;
      if (allAgents.length === 0) {
        console.log('[matchAgentsForInvestor] No agents with user_role=agent, trying all profiles with agent data');
        const allProfiles = await base44.entities.Profile.filter({});
        matchedAgents = allProfiles.filter(p => p.agent || p.user_type === 'agent');
        console.log('[matchAgentsForInvestor] Found', matchedAgents.length, 'profiles with agent data');
      }
      
      // If still no agents, return empty
      if (matchedAgents.length === 0) {
        console.log('[matchAgentsForInvestor] No agents found at all');
        return Response.json({ ok: true, results: [], total: 0 });
      }
      
      // Filter/Prioritize by region if investor has one
      if (investorRegion) {
        // STRICT FILTER: Only return agents matching the region
        // Normalize helper
        const normalize = (s) => s ? s.toString().toLowerCase().trim() : '';
        const target = normalize(investorRegion);
        
        // Filter agents
        matchedAgents = matchedAgents.filter(a => {
           const markets = [
             a.target_state,
             ...(a.markets || []),
             ...(a.agent?.markets || []),
             a.agent?.license_state,
             ...(a.agent?.licensed_states || [])
           ].map(normalize);
           
           // Check for exact match or state code match
           return markets.some(m => m === target || (target.length === 2 && m.includes(target)));
        });

        console.log(`[matchAgentsForInvestor] Filtered to ${matchedAgents.length} agents in ${investorRegion}`);

        // Score agents by region match (all are matches now, so just set 1)
        matchedAgents = matchedAgents.map(a => ({
          ...a,
          _regionMatch: 1
        }));
        
        // Sort by region match first, then by other criteria
        matchedAgents.sort((a, b) => {
          if (a._regionMatch !== b._regionMatch) return b._regionMatch - a._regionMatch;
          // Then by verification status
          const verA = a.agent?.verification_status === 'verified' ? 1 : 0;
          const verB = b.agent?.verification_status === 'verified' ? 1 : 0;
          if (verA !== verB) return verB - verA;
          // Then by experience
          const expA = a.agent?.experience_years || 0;
          const expB = b.agent?.experience_years || 0;
          return expB - expA;
        });
      } else {
        // No region preference, sort by verification and experience
        matchedAgents.sort((a, b) => {
          const verA = a.agent?.verification_status === 'verified' ? 1 : 0;
          const verB = b.agent?.verification_status === 'verified' ? 1 : 0;
          if (verA !== verB) return verB - verA;
          const expA = a.agent?.experience_years || 0;
          const expB = b.agent?.experience_years || 0;
          return expB - expA;
        });
      }
      
      // Take top N
      const topAgents = matchedAgents.slice(0, limit);
      
      // Build results with estimated scores based on region match
      results = topAgents.map(agent => ({
        profile: agent,
        score: investorRegion && (
          agent.target_state === investorRegion || 
          agent.markets?.includes(investorRegion) ||
          agent.agent?.markets?.includes(investorRegion)
        ) ? 0.75 : 0.6, // Base score for any agent match
        region: agent.target_state || agent.agent?.markets?.[0] || null
      }));
    }
    
    console.log('[matchAgentsForInvestor] Returning', results.length, 'results');
    
    return Response.json({ 
      ok: true, 
      results,
      total: results.length
    });
    
  } catch (error) {
    console.error('[matchAgentsForInvestor] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to match agents' 
    }, { status: 500 });
  }
});