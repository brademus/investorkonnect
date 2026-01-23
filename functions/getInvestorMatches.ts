import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * GET INVESTOR MATCHES
 * 
 * Returns all suggested agent matches for the current investor.
 * Each match includes:
 * - Agent profile details
 * - Match score
 * - Explanation
 * - Status
 */
Deno.serve(async (req) => {
  try {
    console.log('[getInvestorMatches] Starting...');
    
    const base44 = createClientFromRequest(req);
    
    // 1. Get current user
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        reason: 'NOT_AUTHENTICATED',
        message: 'Authentication required' 
      }, { status: 401 });
    }
    
    console.log('[getInvestorMatches] User:', user.email);
    
    // 2. Get investor profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    
    if (profiles.length === 0) {
      return Response.json({
        ok: false,
        reason: 'NO_PROFILE',
        message: 'Profile not found',
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    
    // 3. Validate investor role
    if (profile.user_role !== 'investor') {
      return Response.json({
        ok: false,
        reason: 'NOT_INVESTOR',
        message: 'Only investors have suggested agents',
      }, { status: 403 });
    }
    
    console.log('[getInvestorMatches] Investor profile ID:', profile.id);
    
    // 4. Load all matches for this investor
    const allMatches = await base44.entities.Match.filter({
      investorId: profile.id,
    });
    
    console.log('[getInvestorMatches] Found', allMatches.length, 'total matches');
    
    // 5. Filter to active matches (suggested or connected)
    const activeMatches = allMatches.filter(m => 
      m.status === 'suggested' || m.status === 'connected'
    );
    
    console.log('[getInvestorMatches] Filtered to', activeMatches.length, 'active matches');
    
    if (activeMatches.length === 0) {
      return Response.json({
        ok: true,
        matches: [],
      });
    }
    
    // 6. Load all agent profiles
    const agentProfileIds = activeMatches.map(m => m.agentId);
    const agentProfiles = await base44.entities.Profile.filter({});
    
    // Create map of profile ID -> profile
    const profileMap = {};
    for (const p of agentProfiles) {
      profileMap[p.id] = p;
    }
    
    // 7. Build response with enriched match data
    const enrichedMatches = [];
    
    for (const match of activeMatches) {
      const agentProfile = profileMap[match.agentId];
      
      if (!agentProfile) {
        console.warn('[getInvestorMatches] Agent profile not found for match:', match.id);
        continue;
      }
      
      const agent = agentProfile.agent || {};
      
      // Build badges
      const badges = [];
      if (agentProfile.vetted || agent.verification_status === 'verified') {
        badges.push('Verified');
      }
      if (agent.investor_friendly) {
        badges.push('Investor-friendly');
      }
      if (agent.personally_invests) {
        badges.push('Personal investor');
      }
      if (agent.sources_off_market) {
        badges.push('Off-market deals');
      }
      
      enrichedMatches.push({
        match_id: match.id,
        agent_user_id: agentProfile.user_id,
        agent_profile_id: agentProfile.id,
        score: match.score || 0,
        explanation: match.reasons?.join(' ') || 'Matched based on market and investment strategy.',
        status: match.status,
        created_at: match.created_date,
        agent: {
          name: agentProfile.full_name || 'Agent',
          email: agentProfile.email,
          brokerage: agent.brokerage || null,
          markets: agent.markets || agentProfile.markets || [],
          specialties: agent.specialties || [],
          investment_strategies: agent.investment_strategies || [],
          experience_years: agent.experience_years || 0,
          investor_experience_years: agent.investor_experience_years || 0,
          investor_clients_count: agent.investor_clients_count || 0,
          investment_deals_last_12m: agent.investment_deals_last_12m || 0,
          typical_deal_price_range: agent.typical_deal_price_range || null,
          bio: agent.bio || agentProfile.bio || null,
          badges,
        },
      });
    }
    
    // 8. Sort by score descending
    enrichedMatches.sort((a, b) => b.score - a.score);
    
    console.log('[getInvestorMatches] ✅ Returning', enrichedMatches.length, 'enriched matches');
    
    return Response.json({
      ok: true,
      matches: enrichedMatches,
    });
    
  } catch (error) {
    console.error('[getInvestorMatches] ❌ Error:', error);
    return Response.json({ 
      ok: false, 
      reason: 'SERVER_ERROR',
      message: error.message 
    }, { status: 500 });
  }
});