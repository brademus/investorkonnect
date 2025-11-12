/**
 * Match Investors for Agent Function
 * 
 * Finds best investor matches for an agent using cosine similarity
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
    
    // Get agent profile ID
    let agentProfileId = body.agentProfileId;
    if (!agentProfileId) {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      agentProfileId = profiles[0]?.id;
    }
    
    if (!agentProfileId) {
      return Response.json({ error: 'Agent profile not found' }, { status: 404 });
    }
    
    console.log('[matchInvestorsForAgent] Finding matches for agent:', agentProfileId);
    
    // Load agent vector
    const agVectors = await base44.entities.ProfileVector.filter({ 
      profile_id: agentProfileId 
    });
    const agPV = agVectors[0];
    
    if (!agPV?.embedding || !Array.isArray(agPV.embedding)) {
      return Response.json({ 
        error: 'Agent not embedded yet. Please complete your profile.' 
      }, { status: 400 });
    }
    
    console.log('[matchInvestorsForAgent] Agent vector loaded. Region:', agPV.region);
    
    // Get candidate investors (same region first, then all)
    let candidates = await base44.entities.ProfileVector.filter({ 
      role: 'investor',
      ...(agPV.region ? { region: agPV.region } : {})
    });
    
    console.log('[matchInvestorsForAgent] Found', candidates.length, 'investors in region');
    
    // Fallback to all investors if no regional matches
    if (candidates.length === 0) {
      console.log('[matchInvestorsForAgent] No regional matches, loading all investors');
      candidates = await base44.entities.ProfileVector.filter({ role: 'investor' });
      console.log('[matchInvestorsForAgent] Found', candidates.length, 'total investors');
    }
    
    // Calculate similarity scores
    const scored = candidates
      .filter(a => Array.isArray(a.embedding) && a.embedding.length > 0)
      .map(a => ({
        profile_id: a.profile_id,
        score: cosineSim(agPV.embedding, a.embedding),
        region: a.region
      }));
    
    // Sort by score descending
    scored.sort((x, y) => y.score - x.score);
    
    // Take top N
    const top = scored.slice(0, limit);
    
    console.log('[matchInvestorsForAgent] Top', top.length, 'matches calculated');
    
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
    
    console.log('[matchInvestorsForAgent] Returning', results.length, 'results');
    
    return Response.json({ 
      ok: true, 
      results,
      total: scored.length
    });
    
  } catch (error) {
    console.error('[matchInvestorsForAgent] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to match investors' 
    }, { status: 500 });
  }
});