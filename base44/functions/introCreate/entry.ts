import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { agentId, message } = body;

    if (!agentId) {
      return Response.json({ error: 'agentId required' }, { status: 400 });
    }

    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ email: user.email });
    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const investor = profiles[0];
    if (investor.user_type !== 'investor') {
      return Response.json({ error: 'Only investors can send intro requests' }, { status: 403 });
    }

    // Check for existing recent request
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const existing = await base44.entities.IntroRequest.filter({
      investorId: investor.id,
      agentId: agentId
    });

    const recentRequest = existing.find(r => 
      (r.status === 'pending' || r.status === 'accepted') && 
      r.created_date > sevenDaysAgo
    );

    if (recentRequest) {
      return Response.json({ 
        ok: true, 
        requestId: recentRequest.id,
        status: recentRequest.status,
        message: 'Request already exists'
      });
    }

    // Create new request
    const request = await base44.entities.IntroRequest.create({
      investorId: investor.id,
      agentId: agentId,
      message: message || '',
      status: 'pending'
    });

    // Update match status to connected
    const matches = await base44.entities.Match.filter({
      investorId: investor.id,
      agentId: agentId
    });
    if (matches.length > 0) {
      await base44.entities.Match.update(matches[0].id, { status: 'connected' });
    }

    return Response.json({ 
      ok: true, 
      requestId: request.id 
    });

  } catch (error) {
    console.error('Intro create error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});