import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get agent profile
    const profiles = await base44.entities.Profile.filter({ email: user.email });
    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const agent = profiles[0];
    if (agent.user_type !== 'agent') {
      return Response.json({ error: 'Only agents can access inbox' }, { status: 403 });
    }

    // Get pending intro requests
    const requests = await base44.entities.IntroRequest.filter({ 
      agentId: agent.id,
      status: 'pending'
    }, '-created_date');

    // Get investor profiles
    const investorIds = requests.map(r => r.investorId);
    const investors = await base44.entities.Profile.filter({});
    const investorsMap = {};
    investors.forEach(i => investorsMap[i.id] = i);

    // Build results
    const results = requests.map(request => ({
      requestId: request.id,
      investor: {
        userId: investorsMap[request.investorId]?.id,
        name: investorsMap[request.investorId]?.full_name,
        company: investorsMap[request.investorId]?.company,
        markets: investorsMap[request.investorId]?.markets || []
      },
      message: request.message,
      createdAt: request.created_date
    }));

    return Response.json({ requests: results });

  } catch (error) {
    console.error('Inbox list error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});