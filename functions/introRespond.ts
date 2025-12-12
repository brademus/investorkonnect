import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return Response.json({ error: 'requestId and action required' }, { status: 400 });
    }

    if (action !== 'accept' && action !== 'decline') {
      return Response.json({ error: 'action must be accept or decline' }, { status: 400 });
    }

    // Get agent profile
    const profiles = await base44.entities.Profile.filter({ email: user.email });
    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const agent = profiles[0];
    if (agent.user_type !== 'agent') {
      return Response.json({ error: 'Only agents can respond to intro requests' }, { status: 403 });
    }

    // Get request
    const requests = await base44.entities.IntroRequest.filter({ id: requestId });
    if (requests.length === 0) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    const request = requests[0];
    if (request.agentId !== agent.id) {
      return Response.json({ error: 'Not your request' }, { status: 403 });
    }

    if (action === 'accept') {
      // Create room
      const room = await base44.entities.Room.create({
        investorId: request.investorId,
        agentId: request.agentId,
        ndaAcceptedInvestor: false,
        ndaAcceptedAgent: false
      });

      // Create system message
      await base44.entities.RoomMessage.create({
        roomId: room.id,
        senderUserId: 'system',
        kind: 'system',
        text: 'Connection established. Please review and accept the NDA to begin sharing files.'
      });

      // Update request
      await base44.entities.IntroRequest.update(requestId, { status: 'accepted' });

      return Response.json({ 
        ok: true, 
        roomId: room.id 
      });
    } else {
      // Decline
      await base44.entities.IntroRequest.update(requestId, { status: 'declined' });
      return Response.json({ ok: true });
    }

  } catch (error) {
    console.error('Intro respond error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});