import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { matchInvestorToAgent } from './matchingEngine.js';

/**
 * MATCH INVESTOR TO AGENT
 * 
 * Finds best agent match for investor using semantic similarity
 * Called after investor completes subscription
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Match Investor to Agent ===');
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('User:', user.email);
    
    const match = await matchInvestorToAgent(base44, user.id);
    
    if (!match) {
      return Response.json({
        ok: true,
        message: 'No eligible agents found for matching',
        matched: false,
      });
    }
    
    return Response.json({
      ok: true,
      message: 'Investor matched successfully',
      matched: true,
      agentId: match.agent.user_id,
      score: match.score,
      explanation: match.matchExplanation,
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      ok: false, 
      message: error.message 
    }, { status: 500 });
  }
});