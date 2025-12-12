import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ email: user.email });
    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const investor = profiles[0];
    if (investor.user_type !== 'investor') {
      return Response.json({ error: 'Only investors can create matches' }, { status: 403 });
    }

    const investorMarkets = investor.markets || [];
    
    // Get all agents
    const agents = await base44.entities.Profile.filter({ user_type: 'agent' });
    
    // Calculate matches
    const matches = [];
    for (const agent of agents) {
      const agentMarkets = agent.markets || [];
      
      // Find matching markets
      const commonMarkets = investorMarkets.filter(m => 
        agentMarkets.some(am => am.toLowerCase() === m.toLowerCase())
      );
      
      if (commonMarkets.length === 0) continue; // Must have at least one matching market
      
      // Calculate score
      let score = 50; // Base score
      if (agent.vetted) score += 10;
      score += (agent.reputationScore || 0) * 0.3; // Up to 30 points from reputation
      score += commonMarkets.length * 5; // 5 points per matching market
      score = Math.min(100, Math.round(score));
      
      // Generate reasons
      const reasons = [];
      commonMarkets.forEach(market => reasons.push(`${market} Focus`));
      if (agent.vetted) reasons.push('Verified Agent');
      if (agent.reputationScore >= 80) reasons.push('Top Rated');
      
      matches.push({
        investorId: investor.id,
        agentId: agent.id,
        score,
        reasons,
        status: 'suggested'
      });
    }
    
    // Sort by score and take top 20
    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 20);
    
    // Upsert matches
    let created = 0;
    for (const match of topMatches) {
      const existing = await base44.entities.Match.filter({
        investorId: match.investorId,
        agentId: match.agentId
      });
      
      if (existing.length === 0) {
        await base44.entities.Match.create(match);
        created++;
      } else {
        await base44.entities.Match.update(existing[0].id, {
          score: match.score,
          reasons: match.reasons
        });
      }
    }

    return Response.json({ ok: true, created, total: topMatches.length });

  } catch (error) {
    console.error('Match make error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});