import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Agent Performance Dashboard Metrics
 * Calculates conversion funnel and provides AI-driven improvement suggestions
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length || profiles[0].user_role !== 'agent') {
      return Response.json({ error: 'Agent profile not found' }, { status: 404 });
    }

    const profile = profiles[0];

    // Get all matches, intros, rooms, and deals for this agent
    const [matches, intros, rooms, deals] = await Promise.all([
      base44.asServiceRole.entities.Match.filter({ agentId: profile.id }),
      base44.asServiceRole.entities.IntroRequest.filter({ agentId: profile.id }),
      base44.asServiceRole.entities.Room.filter({ agentId: profile.id }),
      base44.asServiceRole.entities.Deal.filter({ agent_id: profile.id })
    ]);

    // Calculate conversion rates
    const totalMatches = matches.length;
    const acceptedIntros = intros.filter(i => i.status === 'accepted').length;
    const activeRooms = rooms.filter(r => !r.closedAt).length;
    const closedDeals = deals.filter(d => d.status === 'closed').length;

    const matchToIntroRate = totalMatches > 0 ? (acceptedIntros / totalMatches) * 100 : 0;
    const introToRoomRate = acceptedIntros > 0 ? (rooms.length / acceptedIntros) * 100 : 0;
    const roomToCloseRate = rooms.length > 0 ? (closedDeals / rooms.length) * 100 : 0;

    // Calculate average time to close
    const closedDealsWithDates = deals
      .filter(d => d.status === 'closed' && d.created_date && d.updated_date)
      .map(d => {
        const created = new Date(d.created_date);
        const closed = new Date(d.updated_date);
        return (closed - created) / (1000 * 60 * 60 * 24); // Days
      });

    const avgTimeToClose = closedDealsWithDates.length > 0
      ? closedDealsWithDates.reduce((a, b) => a + b, 0) / closedDealsWithDates.length
      : 0;

    // Identify weakest metric
    const metrics = [
      { name: 'Match-to-Intro Rate', value: matchToIntroRate, target: 30 },
      { name: 'Intro-to-Room Rate', value: introToRoomRate, target: 60 },
      { name: 'Room-to-Close Rate', value: roomToCloseRate, target: 40 }
    ];

    const weakest = metrics.reduce((min, m) => {
      const gap = m.target - m.value;
      return gap > (min.target - min.value) ? m : min;
    });

    // AI-driven suggestions based on weakest metric
    let suggestion = '';
    if (weakest.name === 'Match-to-Intro Rate') {
      suggestion = 'Your profile visibility is strong, but investors aren\'t converting to intro requests. Try: updating your bio with recent success stories, adding client testimonials, or highlighting unique specialties.';
    } else if (weakest.name === 'Intro-to-Room Rate') {
      suggestion = 'Investors are interested but not moving to deal rooms. Try: responding faster to intro requests (target <4 hours), personalizing your initial message, or offering a free market analysis upfront.';
    } else {
      suggestion = 'You\'re getting into rooms but not closing deals. Try: improving your due diligence process, being more proactive with property sourcing, or setting clearer milestones with investors.';
    }

    return Response.json({
      ok: true,
      metrics: {
        totalMatches,
        acceptedIntros,
        activeRooms,
        closedDeals,
        matchToIntroRate: Math.round(matchToIntroRate * 10) / 10,
        introToRoomRate: Math.round(introToRoomRate * 10) / 10,
        roomToCloseRate: Math.round(roomToCloseRate * 10) / 10,
        avgTimeToClose: Math.round(avgTimeToClose)
      },
      insight: {
        weakestMetric: weakest.name,
        currentValue: Math.round(weakest.value * 10) / 10,
        targetValue: weakest.target,
        suggestion
      }
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});