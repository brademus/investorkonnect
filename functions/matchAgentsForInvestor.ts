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
    
    // Load investor vector
    const invVectors = await base44.entities.ProfileVector.filter({ 
      profile_id: investorProfileId 
    });
    const invPV = invVectors[0];
    
    if (!invPV?.embedding || !Array.isArray(invPV.embedding)) {
      return Response.json({ 
        error: 'Investor not embedded yet. Please complete your profile.' 
      }, { status: 400 });
    }
    
    console.log('[matchAgentsForInvestor] Investor vector loaded. Region:', invPV.region);
    
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
    const profileIds = top.map(t => t.profile_id);
    const profiles = await base44.entities.Profile.filter({});
    const profilesMap = new Map(profiles.map(p => [p.id, p]));
    
    // Build results with full profile data
    const results = top.map(t => ({
      profile: profilesMap.get(t.profile_id) || { id: t.profile_id },
      score: t.score,
      region: t.region
    }));
    
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