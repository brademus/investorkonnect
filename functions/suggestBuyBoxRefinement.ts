import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import OpenAI from 'npm:openai';

/**
 * AI-Driven Buy Box Evolution
 * Analyzes closed deals and suggests optimized criteria
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    const currentBuyBox = profile.investor?.buy_box || {};

    // Get user's closed deals
    const closedDeals = await base44.asServiceRole.entities.Deal.filter({
      investor_id: profile.id,
      status: 'closed'
    });

    // Use AI to analyze patterns and suggest refinements
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
    
    const prompt = `As a real estate investment advisor, analyze this investor's profile and closed deals to suggest buy box refinements.

Current Buy Box:
${JSON.stringify(currentBuyBox, null, 2)}

Closed Deals (${closedDeals.length}):
${JSON.stringify(closedDeals.slice(0, 10), null, 2)}

Investor Profile:
- Markets: ${profile.markets?.join(', ') || 'Not specified'}
- Strategies: ${profile.metadata?.strategies?.join(', ') || 'Not specified'}
- Capital: ${profile.metadata?.capital_available || 'Not specified'}

Provide 3-5 specific, actionable suggestions to refine their buy box criteria based on successful deal patterns. Format as JSON:
{
  "suggestions": [
    {
      "field": "property_type",
      "current": "current value",
      "suggested": "suggested value",
      "reason": "why this refinement makes sense"
    }
  ],
  "confidenceScore": 85
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    const suggestions = JSON.parse(completion.choices[0].message.content);

    return Response.json({
      ok: true,
      currentBuyBox,
      ...suggestions,
      closedDealsCount: closedDeals.length
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});