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
    
    // Get investor profile ID
    let investorProfileId = body.investorProfileId;
    if (!investorProfileId) {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      investorProfileId = profiles[0]?.id;
    }
    
    if (!investorProfileId) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }
    
    console.log('[matchAgentsForInvestor] Finding matches for investor:', investorProfileId);
    
    // Get investor profile for matching context
    const investorProfiles = await base44.entities.Profile.filter({ id: investorProfileId });
    const investorProfile = investorProfiles[0];
    const investorRegion = investorProfile?.target_state || investorProfile?.markets?.[0] || null;
    
    console.log('[matchAgentsForInvestor] Investor region:', investorRegion);
    
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
      total: scored.length
    });
    
  } catch (error) {
    console.error('[matchAgentsForInvestor] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to match agents' 
    }, { status: 500 });
  }
});