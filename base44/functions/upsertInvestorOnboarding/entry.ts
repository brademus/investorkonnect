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
    console.log('=== Upsert Investor Onboarding ===');

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      console.log('❌ Not authenticated');
      return Response.json({ ok: false, reason: 'AUTH_REQUIRED', message: 'Please sign in to save your onboarding' }, { status: 401 });
    }

    console.log('👤 User:', user.email);

    const payload = await req.json();
    console.log('📦 Payload received');

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });

    if (profiles.length === 0) {
      console.log('❌ Profile not found');
      return Response.json({ ok: false, reason: 'PROFILE_NOT_FOUND', message: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    console.log('📋 Found profile:', profile.email);

    await base44.entities.Profile.update(profile.id, {
      markets: [payload.primary_state],
      target_state: payload.primary_state,
      user_role: 'investor',
      onboarding_version: 'v2',
      onboarding_completed_at: new Date().toISOString(),
      metadata: {
        ...profile.metadata,
      },
    });

    console.log('✅ v2 flags set');

    console.log('🧠 Generating investor embedding...');
    try {
      await updateInvestorEmbedding(base44, user.id);
      console.log('✅ Investor embedding generated');
    } catch (embErr) {
      console.error('⚠️ Failed to generate embedding:', embErr);
    }

    return Response.json({ ok: true, message: 'Investor onboarding saved successfully' }, { status: 200 });

  } catch (error) {
    console.error('❌ Upsert investor onboarding error:', error);
    return Response.json({ ok: false, reason: 'SERVER_ERROR', message: error.message }, { status: 500 });
  }
});