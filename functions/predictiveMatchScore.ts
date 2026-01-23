import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { predictiveMatchWithPrompt } from './lib/openaiContractsClient.js';

/**
 * Predictive Match Scoring (PMS)
 * Uses OpenAI Prompt ID: pmpt_692522a97a9c81958b347a6d6e4a1fa20fac2ca0ae147b81
 * Variables: investor_profile, target_market, agents_json
 * 
 * Modes:
 * - Single match: { investorId, agentId } - score a specific pair
 * - Bulk match: { investorId, targetMarket } - find best agents for investor
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { investorId, agentId, targetMarket, useAI } = body;

    if (!investorId) {
      return Response.json({ error: 'investorId required' }, { status: 400 });
    }

    // Get investor profile
    const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: investorId });
    const investor = investorProfiles[0];
    
    if (!investor) {
      return Response.json({ error: 'Investor profile not found' }, { status: 404 });
    }

    // Determine target market
    const market = targetMarket || investor.target_state || investor.markets?.[0] || 'any';

    // MODE 1: Single agent scoring (legacy + AI enhanced)
    if (agentId) {
      const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: agentId });
      const agent = agentProfiles[0];
      
      if (!agent) {
        return Response.json({ error: 'Agent profile not found' }, { status: 404 });
      }

      // Get historical data
      const [rooms, deals] = await Promise.all([
        base44.asServiceRole.entities.Room.filter({
          investorId,
          agentId
        }),
        base44.asServiceRole.entities.Deal.filter({
          investor_id: investorId,
          agent_id: agentId
        })
      ]);

      // Calculate base Trust Score (0-100)
      let trustScore = 50;
      if (investor?.kyc_status === 'approved') trustScore += 15;
      if (agent?.agent?.verification_status === 'verified') trustScore += 15;
      if (investor?.profileNarrative) trustScore += 5;
      if (agent?.agent?.bio) trustScore += 5;
      const closedDeals = deals.filter(d => d.status === 'closed');
      trustScore += Math.min(closedDeals.length * 3, 15);
      trustScore = Math.max(0, Math.min(100, trustScore));

      // Calculate base Deal Likelihood (0-100)
      let dealLikelihood = 40;
      const investorMarkets = investor?.markets || [];
      const agentMarkets = agent?.agent?.markets || [];
      const marketOverlap = investorMarkets.filter(m => agentMarkets.includes(m)).length;
      dealLikelihood += marketOverlap * 10;
      const investorStrategies = investor?.metadata?.strategies || [];
      const agentSpecialties = agent?.agent?.investment_strategies || [];
      const strategyOverlap = investorStrategies.filter(s => agentSpecialties.includes(s)).length;
      dealLikelihood += strategyOverlap * 8;
      if (rooms.length > 0) dealLikelihood += 15;
      dealLikelihood = Math.max(0, Math.min(100, dealLikelihood));

      // If AI mode requested, enhance with GPT-4o analysis
      let aiAnalysis = null;
      if (useAI) {
        try {
          const investorProfileJson = {
            id: investor.id,
            name: investor.full_name,
            markets: investor.markets,
            target_state: investor.target_state,
            strategies: investor.metadata?.strategies,
            experience: investor.metadata?.experience_level,
            risk_tolerance: investor.metadata?.risk_tolerance,
            budget: investor.metadata?.budget,
            kyc_verified: investor.kyc_status === 'approved'
          };

          const agentJson = [{
            id: agent.id,
            name: agent.full_name,
            markets: agent.agent?.markets,
            specialties: agent.agent?.investment_strategies,
            experience_years: agent.agent?.experience_years,
            investor_clients: agent.agent?.investor_clients_count,
            verification_status: agent.agent?.verification_status,
            bio: agent.agent?.bio?.substring(0, 500)
          }];

          aiAnalysis = await predictiveMatchWithPrompt(investorProfileJson, market, agentJson);
        } catch (aiErr) {
          console.error('[predictiveMatchScore] AI analysis failed:', aiErr);
        }
      }

      return Response.json({
        ok: true,
        mode: 'single',
        trustScore,
        dealLikelihood,
        matchScore: Math.round((trustScore + dealLikelihood) / 2),
        factors: {
          kycVerified: investor?.kyc_status === 'approved',
          agentVerified: agent?.agent?.verification_status === 'verified',
          marketAlignment: marketOverlap,
          strategyAlignment: strategyOverlap,
          hasActiveRooms: rooms.length > 0,
          closedDealsCount: closedDeals.length
        },
        aiAnalysis: aiAnalysis?.matches?.[0] || null
      });
    }

    // MODE 2: Bulk matching - find best agents for investor using AI
    const agents = await base44.asServiceRole.entities.Profile.filter({
      user_role: 'agent',
      'agent.verification_status': 'verified'
    });

    // Filter to agents in relevant markets
    const relevantAgents = agents.filter(a => {
      const agentMarkets = a.agent?.markets || [];
      return market === 'any' || agentMarkets.includes(market);
    }).slice(0, 20); // Limit to 20 for API efficiency

    if (relevantAgents.length === 0) {
      return Response.json({
        ok: true,
        mode: 'bulk',
        matches: [],
        summary: 'No verified agents found in target market'
      });
    }

    // Prepare data for AI matching
    const investorProfileJson = {
      id: investor.id,
      name: investor.full_name,
      markets: investor.markets,
      target_state: investor.target_state,
      strategies: investor.metadata?.strategies,
      experience: investor.metadata?.experience_level,
      risk_tolerance: investor.metadata?.risk_tolerance,
      budget: investor.metadata?.budget,
      accreditation: investor.accreditation,
      goals: investor.goals,
      kyc_verified: investor.kyc_status === 'approved'
    };

    const agentsJson = relevantAgents.map(a => ({
      id: a.id,
      name: a.full_name,
      markets: a.agent?.markets,
      specialties: a.agent?.investment_strategies,
      experience_years: a.agent?.experience_years,
      investor_experience_years: a.agent?.investor_experience_years,
      investor_clients: a.agent?.investor_clients_count,
      personally_invests: a.agent?.personally_invests,
      sources_off_market: a.agent?.sources_off_market,
      verification_status: a.agent?.verification_status,
      bio: a.agent?.bio?.substring(0, 300)
    }));

    // Call AI matching
    const aiResult = await predictiveMatchWithPrompt(investorProfileJson, market, agentsJson);

    return Response.json({
      ok: true,
      mode: 'bulk',
      targetMarket: market,
      investorId,
      matches: aiResult.matches || [],
      topRecommendation: aiResult.topRecommendation || null,
      summary: aiResult.summary || 'Matching complete',
      agentCount: relevantAgents.length
    });

  } catch (error) {
    console.error('[predictiveMatchScore] Error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});