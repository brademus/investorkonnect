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

async function updateInvestorEmbedding(base44, userId) {
  const profiles = await base44.entities.Profile.filter({ user_id: userId });
  if (!profiles.length) throw new Error('Profile not found');
  const profile = profiles[0];
  if (profile.user_role !== 'investor') throw new Error('Profile is not an investor');
  const narrative = buildInvestorNarrative(profile);
  const embedding = await embedText(narrative);
  await base44.asServiceRole.entities.Profile.update(profile.id, { profileNarrative: narrative, embedding });
  return { narrative, embedding };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const result = await updateInvestorEmbedding(base44, user.id);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('[updateInvestorEmbedding] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});