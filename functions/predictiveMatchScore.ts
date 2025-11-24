import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Predictive Match Scoring (PMS)
 * Calculates Trust Score and Deal Likelihood based on historical behavior
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { investorId, agentId } = await req.json();

    // Get historical data for both parties
    const [investorProfile, agentProfile, rooms, deals] = await Promise.all([
      base44.asServiceRole.entities.Profile.filter({ id: investorId }),
      base44.asServiceRole.entities.Profile.filter({ id: agentId }),
      base44.asServiceRole.entities.Room.filter({
        $or: [
          { investorId, agentId },
          { investorId: agentId, agentId: investorId }
        ]
      }),
      base44.asServiceRole.entities.Deal.filter({
        $or: [
          { investor_id: investorId, agent_id: agentId },
          { participants: { $in: [investorId, agentId] } }
        ]
      })
    ]);

    const investor = investorProfile[0];
    const agent = agentProfile[0];

    // Calculate Trust Score (0-100)
    let trustScore = 50; // Base score
    
    // KYC verified
    if (investor?.kyc_status === 'approved') trustScore += 15;
    if (agent?.agent?.verification_status === 'verified') trustScore += 15;
    
    // Profile completeness
    if (investor?.profileNarrative) trustScore += 5;
    if (agent?.agent?.bio) trustScore += 5;
    
    // Historical performance
    const closedDeals = deals.filter(d => d.status === 'closed');
    trustScore += Math.min(closedDeals.length * 3, 15);
    
    // Clamp to 0-100
    trustScore = Math.max(0, Math.min(100, trustScore));

    // Calculate Deal Likelihood (0-100)
    let dealLikelihood = 40; // Base score
    
    // Market alignment
    const investorMarkets = investor?.markets || [];
    const agentMarkets = agent?.agent?.markets || [];
    const marketOverlap = investorMarkets.filter(m => agentMarkets.includes(m)).length;
    dealLikelihood += marketOverlap * 10;
    
    // Strategy alignment
    const investorStrategies = investor?.metadata?.strategies || [];
    const agentSpecialties = agent?.agent?.investment_strategies || [];
    const strategyOverlap = investorStrategies.filter(s => agentSpecialties.includes(s)).length;
    dealLikelihood += strategyOverlap * 8;
    
    // Active communication
    if (rooms.length > 0) {
      dealLikelihood += 15;
    }
    
    // Clamp to 0-100
    dealLikelihood = Math.max(0, Math.min(100, dealLikelihood));

    return Response.json({
      ok: true,
      trustScore,
      dealLikelihood,
      factors: {
        kycVerified: investor?.kyc_status === 'approved',
        agentVerified: agent?.agent?.verification_status === 'verified',
        marketAlignment: marketOverlap,
        strategyAlignment: strategyOverlap,
        hasActiveRooms: rooms.length > 0,
        closedDealsCount: closedDeals.length
      }
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});