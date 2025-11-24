import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Personalized Market Intelligence Feed
 * Delivers real-time, relevant market data based on user preferences
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
    const markets = profile.markets || [profile.target_state];
    const strategies = profile.metadata?.strategies || [];
    const buyBox = profile.investor?.buy_box || {};

    // Build dynamic search query based on user preferences
    const searchTerms = [
      ...markets.map(m => `${m} real estate market`),
      ...strategies.map(s => `${s} investment strategy`),
      buyBox.asset_types?.map(t => `${t} properties`) || []
    ].flat().slice(0, 3).join(' OR ');

    // Use Core.InvokeLLM with internet context for real-time market intel
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Provide a concise market intelligence brief for a real estate investor with these preferences:
      
Markets: ${markets.join(', ')}
Strategies: ${strategies.join(', ')}
Buy Box: ${JSON.stringify(buyBox)}

Cover:
1. Current market conditions in their target markets
2. Emerging opportunities relevant to their strategies
3. Key metrics (median prices, cap rates, inventory trends)
4. Action items for the next 30 days

Keep it actionable and data-driven. Use bullet points.`,
      add_context_from_internet: true
    });

    // Parse the response into structured format
    return Response.json({
      ok: true,
      brief: response,
      generatedFor: {
        markets,
        strategies,
        timestamp: new Date().toISOString()
      },
      refreshInterval: '24h'
    });

  } catch (error) {
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});