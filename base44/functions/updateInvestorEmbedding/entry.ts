import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import OpenAI from 'npm:openai@4.52.0';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

/**
 * Build a narrative string from an investor profile for embedding.
 */
function buildInvestorNarrative(profile) {
  const parts = [];
  
  if (profile.full_name) parts.push(`Investor: ${profile.full_name}`);
  if (profile.company) parts.push(`Company: ${profile.company}`);
  if (profile.location) parts.push(`Location: ${profile.location}`);
  if (profile.target_state) parts.push(`Target state: ${profile.target_state}`);
  if (profile.markets?.length) parts.push(`Markets: ${profile.markets.join(', ')}`);
  if (profile.accreditation) parts.push(`Accreditation: ${profile.accreditation}`);
  if (profile.goals) parts.push(`Goals: ${profile.goals}`);
  if (profile.bio) parts.push(`Bio: ${profile.bio}`);
  
  const inv = profile.investor || {};
  if (inv.company_name) parts.push(`Investment company: ${inv.company_name}`);
  if (inv.bio) parts.push(`Investor bio: ${inv.bio}`);
  if (inv.website) parts.push(`Website: ${inv.website}`);
  
  const bb = inv.buy_box || {};
  if (bb.property_types?.length) parts.push(`Property types: ${bb.property_types.join(', ')}`);
  if (bb.min_price || bb.max_price) parts.push(`Price range: $${bb.min_price || 0} - $${bb.max_price || 'unlimited'}`);
  if (bb.strategies?.length) parts.push(`Strategies: ${bb.strategies.join(', ')}`);
  if (bb.markets?.length) parts.push(`Buy box markets: ${bb.markets.join(', ')}`);
  if (bb.states?.length) parts.push(`Buy box states: ${bb.states.join(', ')}`);
  
  const onb = profile.onboarding || {};
  if (onb.experience_level) parts.push(`Experience: ${onb.experience_level}`);
  if (onb.deal_types?.length) parts.push(`Deal types: ${onb.deal_types.join(', ')}`);
  if (onb.investment_strategies?.length) parts.push(`Investment strategies: ${onb.investment_strategies.join(', ')}`);
  if (onb.timeline) parts.push(`Timeline: ${onb.timeline}`);
  if (onb.capital_source) parts.push(`Capital source: ${onb.capital_source}`);
  if (onb.budget_range) parts.push(`Budget range: ${onb.budget_range}`);
  if (onb.risk_tolerance) parts.push(`Risk tolerance: ${onb.risk_tolerance}`);
  if (onb.agent_preferences) parts.push(`Agent preferences: ${onb.agent_preferences}`);
  
  return parts.join('. ') || 'Investor profile with limited information.';
}

/**
 * Generate an embedding vector from text using OpenAI.
 */
async function embedText(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Update investor embedding: build narrative, generate embedding, store in ProfileVector.
 */
async function updateInvestorEmbedding(base44, userId) {
  const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: userId });
  const profile = profiles?.[0];
  if (!profile) throw new Error('Profile not found for user ' + userId);
  
  const narrative = buildInvestorNarrative(profile);
  console.log('Narrative length:', narrative.length);
  
  const embedding = await embedText(narrative);
  console.log('Embedding dimensions:', embedding.length);
  
  // Update profile with narrative
  await base44.asServiceRole.entities.Profile.update(profile.id, {
    profileNarrative: narrative,
  });
  
  // Upsert ProfileVector
  const existing = await base44.asServiceRole.entities.ProfileVector.filter({ profile_id: profile.id });
  const region = profile.target_state || profile.markets?.[0] || '';
  
  const vectorData = {
    profile_id: profile.id,
    role: 'investor',
    region,
    model: 'text-embedding-3-small',
    embedding,
    updated_at: new Date().toISOString(),
  };
  
  if (existing?.length > 0) {
    await base44.asServiceRole.entities.ProfileVector.update(existing[0].id, vectorData);
  } else {
    await base44.asServiceRole.entities.ProfileVector.create(vectorData);
  }
  
  return { narrative, embedding };
}

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