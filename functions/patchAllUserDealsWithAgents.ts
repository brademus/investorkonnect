import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Patches ALL deals for current user that have rooms but missing selected_agent_ids
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get current user's profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get all deals for this investor
    const deals = await base44.entities.Deal.filter({ investor_id: profile.id });

    if (!deals || deals.length === 0) {
      return Response.json({ 
        ok: true,
        patched_count: 0,
        message: 'No deals found for this user'
      });
    }

    const patchedDeals = [];

    for (const deal of deals) {
      // Skip if already has selected_agent_ids
      if (deal.metadata?.selected_agent_ids && deal.metadata.selected_agent_ids.length > 0) {
        continue;
      }

      // Get rooms for this deal
      const rooms = await base44.entities.Room.filter({ deal_id: deal.id });
      const agentIds = [...new Set(rooms.map(r => r.agentId).filter(Boolean))];

      if (agentIds.length === 0) {
        continue;
      }

      // Patch the deal
      await base44.entities.Deal.update(deal.id, {
        metadata: {
          ...deal.metadata,
          selected_agent_ids: agentIds
        }
      });

      patchedDeals.push({
        deal_id: deal.id,
        agent_ids: agentIds
      });
    }

    return Response.json({
      ok: true,
      patched_count: patchedDeals.length,
      patched_deals: patchedDeals,
      message: `Patched ${patchedDeals.length} deal(s) with agent IDs`
    });
  } catch (error) {
    console.error('[patchAllUserDealsWithAgents]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});