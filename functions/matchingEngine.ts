import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import OpenAI from 'npm:openai@4.28.0';

/**
 * AI MATCHING ENGINE
 * 
 * Core utilities for building narratives, generating embeddings,
 * and matching investors to agents using semantic similarity.
 */

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// ====================================================
// NARRATIVE BUILDERS
// ====================================================

/**
 * Build investor narrative from profile
 */
export function buildInvestorNarrative(profile) {
  const meta = profile.metadata || {};
  const basic = meta.basicProfile || {};
  const capital = meta.capitalFinancing || {};
  const strategy = meta.strategyDeals || {};
  const markets = meta.targetMarkets || {};
  const dealStructure = meta.dealStructure || {};
  const riskSpeed = meta.riskSpeed || {};
  const agentWorking = meta.agentWorking || {};
  const experience = meta.experienceAccreditation || {};
  
  const parts = [
    'Investor profile:',
    '',
    `- Target state/market: ${profile.target_state || profile.markets?.[0] || 'Not specified'}`,
    `- Specific areas: ${markets.specific_cities_counties || 'Any in state'}`,
    `- Area importance: ${markets.market_area_importance || 'Not specified'}`,
    '',
    `- Investor type: ${basic.investor_description || 'Not specified'}`,
    `- Deals closed (24 months): ${basic.deals_closed_24mo || 'Not specified'}`,
    `- Typical deal size: ${basic.typical_deal_size || 'Not specified'}`,
    `- Price range in target state: ${markets.state_price_min || 'N/A'}–${markets.state_price_max || 'N/A'}`,
    '',
    `- Capital available (12 months): ${capital.capital_available_12mo || 'Not specified'}`,
    `- Financing methods: ${capital.financing_methods?.join(', ') || 'Not specified'}`,
    `- Financing lined up: ${capital.financing_lined_up || 'Not specified'}`,
    `- Proof of funds intent: ${capital.pof_verification_intent || 'Not specified'}`,
    '',
    `- Investment strategies: ${strategy.investment_strategies?.join(', ') || 'Not specified'}`,
    `- Primary strategy: ${strategy.primary_strategy || 'Not specified'}`,
    `- Property types: ${strategy.property_types?.join(', ') || 'Not specified'}`,
    `- Property condition: ${strategy.property_condition || 'Not specified'}`,
    '',
    `- Deal types open to: ${dealStructure.deal_types_open_to?.join(', ') || 'Not specified'}`,
    `- Preferred deal structure: ${dealStructure.preferred_deal_structure?.join(', ') || 'Not specified'}`,
    `- Most important now: ${dealStructure.most_important_now || 'Not specified'}`,
    `- Target hold period: ${dealStructure.target_hold_period || 'Not specified'}`,
    '',
    `- Decision speed: ${riskSpeed.decision_speed_on_deal || 'Not specified'}`,
    `- Typical earnest money: ${riskSpeed.typical_earnest_money_pct || 'Not specified'}%`,
    `- Comfortable with non-refundable EM: ${riskSpeed.comfortable_non_refundable_em || 'Not specified'}`,
    `- Most recent deal: ${riskSpeed.most_recent_deal || 'Not specified'}`,
    '',
    `- What from agent: ${agentWorking.what_from_agent?.join(', ') || 'Not specified'}`,
    `- Communication preferences: ${agentWorking.communication_preferences?.join(', ') || 'Not specified'}`,
    `- Preferred agent response time: ${agentWorking.preferred_agent_response_time || 'Not specified'}`,
    `- Agent deal breakers: ${agentWorking.agent_deal_breakers || 'None specified'}`,
    '',
    `- Accredited investor: ${experience.accredited_investor || 'Not specified'}`,
    `- Investment holding structures: ${experience.investment_holding_structures?.join(', ') || 'Not specified'}`,
    `- Background links: ${experience.background_links || 'None provided'}`,
    `- Notes for agent: ${experience.anything_else_for_agent || 'None provided'}`,
  ];
  
  return parts.join('\n');
}

/**
 * Build agent narrative from profile
 */
export function buildAgentNarrative(profile) {
  const agent = profile.agent || {};
  
  const parts = [
    'Agent profile:',
    '',
    `- Licensed states: ${agent.licensed_states?.join(', ') || agent.license_state || 'Not specified'}`,
    `- Primary markets: ${agent.markets?.join(', ') || profile.markets?.join(', ') || 'Not specified'}`,
    `- Primary neighborhoods: ${agent.primary_neighborhoods_notes || 'Not specified'}`,
    '',
    `- Property specialties: ${agent.specialties?.join(', ') || 'Not specified'}`,
    `- Investment strategies supported: ${agent.investment_strategies?.join(', ') || 'Not specified'}`,
    `- Typical deal price range: ${agent.typical_deal_price_range || 'Not specified'}`,
    '',
    `- Years as licensed agent: ${agent.experience_years || 'Not specified'}`,
    `- Years with investor clients: ${agent.investor_experience_years || 'Not specified'}`,
    `- Investor clients worked with: ${agent.investor_clients_count || 'Not specified'}`,
    `- % clients who are investors: ${agent.investor_client_percent_bucket || 'Not specified'}`,
    `- Actively prioritizes investors: ${agent.investor_friendly ? 'Yes' : 'No'}`,
    '',
    `- Full-time agent: ${agent.is_full_time_agent ? 'Yes' : 'No'}`,
    `- Works in team: ${agent.works_in_team ? 'Yes' : 'No'}`,
    `- Team role: ${agent.team_role_notes || 'N/A'}`,
    '',
    `- Active clients now: ${agent.active_client_count || 'Not specified'}`,
    `- Investment deals (last 12 months): ${agent.investment_deals_last_12m || 'Not specified'}`,
    `- Client focus: ${agent.client_focus || 'Not specified'}`,
    '',
    `- Personally invests: ${agent.personally_invests ? 'Yes' : 'No'}`,
    `- Personal investing: ${agent.personal_investing_notes || 'N/A'}`,
    '',
    `- Investor types served: ${agent.investor_types_served?.join(', ') || 'Not specified'}`,
    `- Metrics used: ${agent.metrics_used?.join(', ') || 'Not specified'}`,
    `- Risk approach (1-5): ${agent.risk_approach_score || 'Not specified'}`,
    '',
    `- Deal sourcing methods: ${agent.deal_sourcing_methods?.join(', ') || 'Not specified'}`,
    `- Sources off-market deals: ${agent.sources_off_market ? 'Yes' : 'No'}`,
    `- Off-market methods: ${agent.off_market_methods_notes || 'N/A'}`,
    `- Marketing methods: ${agent.marketing_methods?.join(', ') || 'Not specified'}`,
    '',
    `- Professional network: ${agent.pro_network_types?.join(', ') || 'Not specified'}`,
    `- Can refer professionals: ${agent.can_refer_professionals ? 'Yes' : 'No'}`,
    `- Refers to: ${agent.refer_professionals_notes || 'N/A'}`,
    `- Can provide references: ${agent.can_provide_investor_references ? 'Yes' : 'No'}`,
    '',
    `- Update frequency: ${agent.update_frequency || 'Not specified'}`,
    `- Response time: ${agent.typical_response_time || 'Not specified'}`,
    `- Communication channels: ${agent.preferred_communication_channels?.join(', ') || 'Not specified'}`,
    `- Languages: ${agent.languages_spoken?.join(', ') || 'English'}`,
    '',
    `- Commission structure: ${agent.commission_structure || 'Not specified'}`,
    `- Investor certifications: ${agent.investor_certifications || 'None'}`,
    '',
    `- What sets them apart: ${agent.what_sets_you_apart || 'Not specified'}`,
    `- Best deal case study: ${agent.case_study_best_deal || 'Not provided'}`,
    `- Why good fit: ${agent.why_good_fit_notes || 'Not specified'}`,
    `- Investment philosophy: ${agent.investment_philosophy_notes || 'Not specified'}`,
    `- Strengths and challenges: ${agent.strengths_and_challenges_notes || 'Not specified'}`,
    `- Bio: ${agent.bio || 'Not provided'}`,
  ];
  
  return parts.join('\n');
}

// ====================================================
// EMBEDDING HELPER
// ====================================================

/**
 * Generate OpenAI embedding for text
 */
export async function embedText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid text for embedding');
  }
  
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Cannot embed empty text');
  }
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: trimmed,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('[embedText] OpenAI error:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

// ====================================================
// COSINE SIMILARITY
// ====================================================

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return -1;
  }
  
  if (a.length !== b.length || a.length === 0) {
    return -1;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return -1;
  }
  
  return dotProduct / (normA * normB);
}

// ====================================================
// UPDATE EMBEDDINGS
// ====================================================

/**
 * Update investor embedding
 */
export async function updateInvestorEmbedding(base44, userId) {
  console.log('[updateInvestorEmbedding] Starting for user:', userId);
  
  const profiles = await base44.entities.Profile.filter({ user_id: userId });
  
  if (profiles.length === 0) {
    throw new Error('Profile not found');
  }
  
  const profile = profiles[0];
  
  if (profile.user_role !== 'investor') {
    throw new Error('Profile is not an investor');
  }
  
  const narrative = buildInvestorNarrative(profile);
  console.log('[updateInvestorEmbedding] Generated narrative:', narrative.substring(0, 200) + '...');
  
  const embedding = await embedText(narrative);
  console.log('[updateInvestorEmbedding] Generated embedding, length:', embedding.length);
  
  await base44.asServiceRole.entities.Profile.update(profile.id, {
    profileNarrative: narrative,
    embedding: embedding,
  });
  
  console.log('[updateInvestorEmbedding] ✅ Saved to profile');
  
  return { narrative, embedding };
}

/**
 * Update agent embedding
 */
export async function updateAgentEmbedding(base44, userId) {
  console.log('[updateAgentEmbedding] Starting for user:', userId);
  
  const profiles = await base44.entities.Profile.filter({ user_id: userId });
  
  if (profiles.length === 0) {
    throw new Error('Profile not found');
  }
  
  const profile = profiles[0];
  
  if (profile.user_role !== 'agent') {
    throw new Error('Profile is not an agent');
  }
  
  const narrative = buildAgentNarrative(profile);
  console.log('[updateAgentEmbedding] Generated narrative:', narrative.substring(0, 200) + '...');
  
  const embedding = await embedText(narrative);
  console.log('[updateAgentEmbedding] Generated embedding, length:', embedding.length);
  
  await base44.asServiceRole.entities.Profile.update(profile.id, {
    profileNarrative: narrative,
    embedding: embedding,
  });
  
  console.log('[updateAgentEmbedding] ✅ Saved to profile');
  
  return { narrative, embedding };
}

// ====================================================
// MATCH INVESTOR TO AGENT (ENHANCED)
// ====================================================

/**
 * Match investor to best agents using semantic similarity
 * Creates Match records for top 5 agents
 */
export async function matchInvestorToAgent(base44, investorUserId) {
  console.log('[matchInvestorToAgent] Starting for investor:', investorUserId);
  
  // 1. Load investor
  const investorProfiles = await base44.entities.Profile.filter({ 
    user_id: investorUserId 
  });
  
  if (investorProfiles.length === 0) {
    throw new Error('Investor profile not found');
  }
  
  const investor = investorProfiles[0];
  
  // 2. Check investor is ready
  if (investor.user_role !== 'investor') {
    throw new Error('Profile is not an investor');
  }
  
  const isOnboarded = 
    investor.onboarding_version === 'v2' &&
    investor.onboarding_completed_at &&
    investor.user_role === 'investor';
  
  const isKYCVerified = investor.kyc_status === 'approved';
  const hasNDA = investor.nda_accepted;
  
  if (!isOnboarded) {
    console.log('[matchInvestorToAgent] ❌ Investor not onboarded');
    return null;
  }
  
  if (!isKYCVerified) {
    console.log('[matchInvestorToAgent] ❌ Investor KYC not verified');
    return null;
  }
  
  if (!hasNDA) {
    console.log('[matchInvestorToAgent] ❌ Investor NDA not accepted');
    return null;
  }
  
  // 3. Ensure investor has embedding
  if (!investor.embedding || investor.embedding.length === 0) {
    console.log('[matchInvestorToAgent] Generating investor embedding...');
    await updateInvestorEmbedding(base44, investorUserId);
    
    // Reload profile
    const reloadedProfiles = await base44.entities.Profile.filter({ 
      user_id: investorUserId 
    });
    Object.assign(investor, reloadedProfiles[0]);
  }
  
  // 4. Get investor target state
  const targetState = investor.target_state || investor.markets?.[0];
  
  if (!targetState) {
    console.log('[matchInvestorToAgent] ⚠️ No target state, will match all agents');
  }
  
  console.log('[matchInvestorToAgent] Target state:', targetState);
  
  // 5. Find eligible agents
  const allProfiles = await base44.entities.Profile.filter({});
  
  const eligibleAgents = allProfiles.filter(profile => {
    if (profile.user_role !== 'agent') return false;
    
    const hasNewOnboarding = 
      profile.onboarding_version === 'agent-v2-deep' &&
      profile.onboarding_completed_at;
    
    if (!hasNewOnboarding) return false;
    
    if (!profile.embedding || profile.embedding.length === 0) return false;
    
    // Prefer agents in same state, but allow all for now
    if (targetState) {
      const agentMarkets = profile.agent?.markets || profile.markets || [];
      const matchesState = agentMarkets.includes(targetState);
      
      if (matchesState) {
        profile._stateMatch = true;
      }
    }
    
    return true;
  });
  
  console.log('[matchInvestorToAgent] Found', eligibleAgents.length, 'eligible agents');
  
  if (eligibleAgents.length === 0) {
    console.log('[matchInvestorToAgent] ⚠️ No eligible agents found');
    return null;
  }
  
  // 6. Calculate similarities and rank agents
  const rankedAgents = [];
  
  for (const agent of eligibleAgents) {
    const score = cosineSimilarity(investor.embedding, agent.embedding);
    
    // Boost score if agent is in same state
    let adjustedScore = score;
    if (agent._stateMatch) {
      adjustedScore *= 1.1; // 10% boost for state match
    }
    
    console.log('[matchInvestorToAgent] Agent', agent.user_id, 'score:', score.toFixed(3), 
                agent._stateMatch ? '(state match)' : '');
    
    rankedAgents.push({
      agent,
      score,
      adjustedScore,
      stateMatch: agent._stateMatch || false,
    });
  }
  
  // Sort by adjusted score
  rankedAgents.sort((a, b) => b.adjustedScore - a.adjustedScore);
  
  if (rankedAgents.length === 0) {
    console.log('[matchInvestorToAgent] ⚠️ No valid matches');
    return null;
  }
  
  // 7. Take top 5 agents
  const topAgents = rankedAgents.slice(0, 5);
  
  console.log('[matchInvestorToAgent] Top', topAgents.length, 'agents selected');
  
  // 8. Generate explanations and create Match records
  const matches = [];
  
  for (let i = 0; i < topAgents.length; i++) {
    const { agent, score, stateMatch } = topAgents[i];
    
    // Generate explanation
    const explanation = await generateMatchExplanation(
      investor.profileNarrative,
      agent.profileNarrative
    );
    
    console.log('[matchInvestorToAgent] Generated explanation for agent', agent.user_id);
    
    // Create match reasons array
    const reasons = [explanation];
    if (stateMatch) {
      reasons.push(`Operates in your target market: ${targetState}`);
    }
    
    // Check if match already exists
    const existingMatches = await base44.entities.Match.filter({
      investorId: investor.id,
      agentId: agent.id,
    });
    
    if (existingMatches.length > 0) {
      // Update existing match
      const match = existingMatches[0];
      await base44.asServiceRole.entities.Match.update(match.id, {
        score,
        reasons,
        status: 'suggested',
      });
      console.log('[matchInvestorToAgent] Updated existing match:', match.id);
      matches.push({ ...match, score, reasons });
    } else {
      // Create new match
      const newMatch = await base44.asServiceRole.entities.Match.create({
        investorId: investor.id,
        agentId: agent.id,
        score,
        reasons,
        status: 'suggested',
      });
      console.log('[matchInvestorToAgent] Created new match:', newMatch.id);
      matches.push(newMatch);
    }
  }
  
  // 9. Also update investor profile with best match (for backward compatibility)
  const bestAgent = topAgents[0].agent;
  const bestScore = topAgents[0].score;
  const bestExplanation = await generateMatchExplanation(
    investor.profileNarrative,
    bestAgent.profileNarrative
  );
  
  await base44.asServiceRole.entities.Profile.update(investor.id, {
    matchedAgentId: bestAgent.user_id,
    matchScore: bestScore,
    matchExplanation: bestExplanation,
  });
  
  console.log('[matchInvestorToAgent] ✅ Created/updated', matches.length, 'matches');
  console.log('[matchInvestorToAgent] ✅ Updated investor profile with best match');
  
  return {
    investor,
    agent: bestAgent, // Best agent for backward compatibility
    score: bestScore,
    matchExplanation: bestExplanation,
    allMatches: matches, // All top matches
  };
}

/**
 * Generate human-readable match explanation using LLM
 */
async function generateMatchExplanation(investorNarrative, agentNarrative) {
  const prompt = `You are an expert real estate matchmaker.

Here is an investor profile:
${investorNarrative}

Here is an agent profile:
${agentNarrative}

Explain in 2–3 sentences why this agent is a good fit for this investor.
Mention strategy, markets, deal size, and working style.
Keep it clear, specific, and positive.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional real estate matchmaker helping investors and agents connect.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('[generateMatchExplanation] OpenAI error:', error);
    return 'This agent was matched based on market expertise, investment strategy alignment, and professional experience.';
  }
}