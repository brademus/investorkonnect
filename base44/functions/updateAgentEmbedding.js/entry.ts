import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import OpenAI from 'npm:openai@4.28.0';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

function buildAgentNarrative(profile) {
  const agent = profile.agent || {};
  const parts = [
    'Agent profile:',
    `- Licensed states: ${agent.licensed_states?.join(', ') || agent.license_state || 'Not specified'}`,
    `- Primary markets: ${agent.markets?.join(', ') || profile.markets?.join(', ') || 'Not specified'}`,
    `- Property specialties: ${agent.specialties?.join(', ') || 'Not specified'}`,
    `- Investment strategies supported: ${agent.investment_strategies?.join(', ') || 'Not specified'}`,
    `- Years as licensed agent: ${agent.experience_years || 'Not specified'}`,
    `- Years with investor clients: ${agent.investor_experience_years || 'Not specified'}`,
    `- Investor clients worked with: ${agent.investor_clients_count || 'Not specified'}`,
    `- Actively prioritizes investors: ${agent.investor_friendly ? 'Yes' : 'No'}`,
    `- Investment deals (last 12 months): ${agent.investment_deals_last_12m || 'Not specified'}`,
    `- What sets them apart: ${agent.what_sets_you_apart || 'Not specified'}`,
    `- Bio: ${agent.bio || 'Not provided'}`,
  ];
  return parts.join('\n');
}

async function embedText(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Cannot embed empty text');
  const response = await openai.embeddings.create({ model: 'text-embedding-3-small', input: trimmed });
  return response.data[0].embedding;
}

async function updateAgentEmbedding(base44, userId) {
  const profiles = await base44.entities.Profile.filter({ user_id: userId });
  if (!profiles.length) throw new Error('Profile not found');
  const profile = profiles[0];
  if (profile.user_role !== 'agent') throw new Error('Profile is not an agent');
  const narrative = buildAgentNarrative(profile);
  const embedding = await embedText(narrative);
  await base44.asServiceRole.entities.Profile.update(profile.id, { profileNarrative: narrative, embedding });
  return { narrative, embedding };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const result = await updateAgentEmbedding(base44, user.id);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('[updateAgentEmbedding] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});