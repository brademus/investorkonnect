import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const vettedOnly = url.searchParams.get('vettedOnly') === 'true';
    const status = url.searchParams.get('status') || 'suggested';

    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ email: user.email });
    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    const investor = profiles[0];

    // Get matches
    let matches = await base44.entities.Match.filter({ 
      investorId: investor.id,
      status 
    }, '-score');

    // Get agent profiles
    const agentIds = matches.map(m => m.agentId);
    const agents = await base44.entities.Profile.filter({});
    const agentsMap = {};
    agents.forEach(a => agentsMap[a.id] = a);

    // Build results
    const results = [];
    for (const match of matches) {
      const agent = agentsMap[match.agentId];
      if (!agent) continue;
      
      if (vettedOnly && !agent.vetted) continue;

      results.push({
        matchId: match.id,
        agent: {
          userId: agent.id,
          name: agent.full_name,
          headshotUrl: agent.headshotUrl,
          company: agent.company,
          markets: agent.markets || [],
          vetted: agent.vetted,
          reputationScore: agent.reputationScore || 0,
          bio: agent.bio
        },
        score: match.score,
        reasons: match.reasons,
        status: match.status
      });
    }

    return Response.json({ 
      results,
      total: results.length 
    });

  } catch (error) {
    console.error('Match list error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});