import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { updateInvestorEmbedding } from './matchingEngine.js';

/**
 * UPDATE INVESTOR EMBEDDING
 * 
 * Generates narrative and embedding for investor profile
 * Called after investor completes onboarding
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Update Investor Embedding ===');
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('User:', user.email);
    
    const result = await updateInvestorEmbedding(base44, user.id);
    
    return Response.json({
      ok: true,
      message: 'Investor embedding updated',
      narrativeLength: result.narrative.length,
      embeddingLength: result.embedding.length,
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      ok: false, 
      message: error.message 
    }, { status: 500 });
  }
});