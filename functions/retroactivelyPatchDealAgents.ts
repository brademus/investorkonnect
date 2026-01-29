import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Retroactively patch deals with selected_agent_ids from their rooms
 * Takes deal_id + agent profile IDs, or auto-extracts from rooms if not provided
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { deal_id, agent_profile_ids } = await req.json();

    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }

    // Get the deal
    const deals = await base44.entities.Deal.filter({ id: deal_id });
    const deal = deals[0];

    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    // If agent_profile_ids provided, use them; otherwise extract from rooms
    let agentIds = agent_profile_ids || [];

    if (!agentIds || agentIds.length === 0) {
      // Get all rooms for this deal and extract agent IDs
      const rooms = await base44.entities.Room.filter({ deal_id });
      agentIds = [...new Set(rooms.map(r => r.agentId).filter(Boolean))];
    }

    if (agentIds.length === 0) {
      return Response.json({ 
        ok: false, 
        message: 'No agents found for this deal',
        deal_id 
      });
    }

    // Update deal metadata
    const updated = await base44.entities.Deal.update(deal_id, {
      metadata: {
        ...deal.metadata,
        selected_agent_ids: agentIds
      }
    });

    return Response.json({
      ok: true,
      deal_id,
      patched_agent_ids: agentIds,
      message: `Patched ${agentIds.length} agent(s) to deal ${deal_id}`
    });
  } catch (error) {
    console.error('[retroactivelyPatchDealAgents]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});