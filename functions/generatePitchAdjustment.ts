import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai';

/**
 * AI-Driven Pitch Personalization for Agents
 * Generates personalized pitch suggestions for agents targeting specific investors
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { investorId } = await req.json();

    // Get both profiles
    const [agentProfiles, investorProfiles] = await Promise.all([
      base44.entities.Profile.filter({ user_id: user.id }),
      base44.asServiceRole.entities.Profile.filter({ id: investorId })
    ]);

    if (!agentProfiles.length || !investorProfiles.length) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const agent = agentProfiles[0];
    const investor = investorProfiles[0];

    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    
    const prompt = `You are a sales coach helping a real estate agent craft a personalized pitch for a specific investor.

Agent Profile:
- Markets: ${agent.agent?.markets?.join(', ') || 'Not specified'}
- Specialties: ${agent.agent?.specialties?.join(', ') || 'Not specified'}
- Experience: ${agent.agent?.experience_years || 'Not specified'} years
- Investor Deals (last 12m): ${agent.agent?.investment_deals_last_12m || 0}
- Bio: ${agent.agent?.bio || 'Not provided'}

Target Investor Profile:
- Markets: ${investor.markets?.join(', ') || 'Not specified'}
- Strategies: ${investor.metadata?.strategies?.join(', ') || 'Not specified'}
- Buy Box: ${JSON.stringify(investor.investor?.buy_box || {})}
- Goals: ${investor.goals || 'Not specified'}

Generate a personalized pitch strategy with 3-5 key talking points that highlight the agent's strengths most relevant to THIS investor. Format as JSON:
{
  "talkingPoints": [
    {
      "point": "Your key strength",
      "why": "Why it matters to this investor",
      "example": "Specific example or proof point"
    }
  ],
  "iceBreaker": "Opening message suggestion",
  "valueProposition": "One sentence unique value",
  "warningFlags": ["Things to avoid based on investor profile"]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8
    });

    const strategy = JSON.parse(completion.choices[0].message.content);

    return Response.json({
      ok: true,
      investorName: investor.full_name,
      ...strategy
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});