import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import OpenAI from 'npm:openai@4.28.0';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

function buildInvestorNarrative(profile) {
  const meta = profile.metadata || {};
  const basic = meta.basicProfile || {};
  const capital = meta.capitalFinancing || {};
  const strategy = meta.strategyDeals || {};
  const markets = meta.targetMarkets || {};
  const parts = [
    'Investor profile:',
    `- Target state/market: ${profile.target_state || profile.markets?.[0] || 'Not specified'}`,
    `- Specific areas: ${markets.specific_cities_counties || 'Any in state'}`,
    `- Investor type: ${basic.investor_description || 'Not specified'}`,
    `- Deals closed (24 months): ${basic.deals_closed_24mo || 'Not specified'}`,
    `- Capital available (12 months): ${capital.capital_available_12mo || 'Not specified'}`,
    `- Financing methods: ${capital.financing_methods?.join(', ') || 'Not specified'}`,
    `- Investment strategies: ${strategy.investment_strategies?.join(', ') || 'Not specified'}`,
    `- Property types: ${strategy.property_types?.join(', ') || 'Not specified'}`,
  ];
  return parts.join('\n');
}

async function embedText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Cannot embed empty text');
  const response = await openai.embeddings.create({ model: 'text-embedding-3-small', input: trimmed });
  return response.data[0].embedding;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return -1;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  normA = Math.sqrt(normA); normB = Math.sqrt(normB);
  return (normA === 0 || normB === 0) ? -1 : dot / (normA * normB);
}

async function generateMatchExplanation(investorNarrative, agentNarrative) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional real estate matchmaker helping investors and agents connect.' },
        { role: 'user', content: `Explain in 2-3 sentences why this agent is a good fit for this investor. Mention strategy, markets, deal size, and working style.\n\nInvestor:\n${investorNarrative}\n\nAgent:\n${agentNarrative}` },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });
    return response.choices[0].message.content.trim();
  } catch {
    return 'This agent was matched based on market expertise, investment strategy alignment, and professional experience.';
  }
}

async function matchInvestorToAgent(base44, investorUserId) {
  console.log('[matchInvestorToAgent] Starting for investor:', investorUserId);

  const investorProfiles = await base44.entities.Profile.filter({ user_id: investorUserId });
  if (!investorProfiles.length) throw new Error('Investor profile not found');
  const investor = investorProfiles[0];
  if (investor.user_role !== 'investor') throw new Error('Profile is not an investor');

  const isOnboarded = investor.onboarding_version === 'v2' && investor.onboarding_completed_at;
  const isKYCVerified = investor.kyc_status === 'approved';
  const hasNDA = investor.nda_accepted;
  const hasSubscription = investor.subscription_status === 'active' || investor.subscription_status === 'trialing';

  if (!isOnboarded) { console.log('[matchInvestorToAgent] ❌ Not onboarded'); return null; }
  if (!isKYCVerified) { console.log('[matchInvestorToAgent] ❌ KYC not verified'); return null; }
  if (!hasNDA) { console.log('[matchInvestorToAgent] ❌ NDA not accepted'); return null; }
  if (!hasSubscription) { console.log('[matchInvestorToAgent] ❌ No active subscription'); return null; }

  if (!investor.embedding || investor.embedding.length === 0) {
    console.log('[matchInvestorToAgent] Generating investor embedding...');
    const narrative = buildInvestorNarrative(investor);
    const embedding = await embedText(narrative);
    await base44.asServiceRole.entities.Profile.update(investor.id, { profileNarrative: narrative, embedding });
    investor.embedding = embedding;
    investor.profileNarrative = narrative;
  }

  const targetState = investor.target_state || investor.markets?.[0];
  const allProfiles = await base44.entities.Profile.filter({});
  const eligibleAgents = allProfiles.filter(p => {
    if (p.user_role !== 'agent') return false;
    if (!p.onboarding_version?.includes('agent') || !p.onboarding_completed_at) return false;
    if (!p.embedding || p.embedding.length === 0) return false;
    if (targetState) {
      const agentMarkets = p.agent?.markets || p.markets || [];
      if (agentMarkets.includes(targetState)) p._stateMatch = true;
    }
    return true;
  });

  console.log('[matchInvestorToAgent] Eligible agents:', eligibleAgents.length);
  if (!eligibleAgents.length) return null;

  let bestAgent = null, bestScore = -1;
  for (const agent of eligibleAgents) {
    const score = cosineSimilarity(investor.embedding, agent.embedding);
    const adjusted = agent._stateMatch ? score * 1.1 : score;
    if (adjusted > bestScore) { bestScore = score; bestAgent = agent; }
  }

  if (!bestAgent) return null;

  const explanation = await generateMatchExplanation(investor.profileNarrative, bestAgent.profileNarrative);

  await base44.asServiceRole.entities.Profile.update(investor.id, {
    matchedAgentId: bestAgent.user_id,
    matchScore: bestScore,
    matchExplanation: explanation,
  });

  console.log('[matchInvestorToAgent] ✅ Matched to:', bestAgent.user_id, 'score:', bestScore.toFixed(3));
  return { investor, agent: bestAgent, score: bestScore, matchExplanation: explanation };
}

/**
 * MATCH INVESTOR TO AGENT
 * Finds best agent match for investor using semantic similarity
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Match Investor to Agent ===');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Not authenticated' }, { status: 401 });

    console.log('User:', user.email);
    const match = await matchInvestorToAgent(base44, user.id);

    if (!match) return Response.json({ ok: true, message: 'No eligible agents found for matching', matched: false });

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
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
});