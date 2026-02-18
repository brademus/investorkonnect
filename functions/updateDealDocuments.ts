import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Update deal documents and/or pipeline_stage using service role.
 * Agents cannot update Deal entities directly from the client SDK,
 * so this function provides an authorized path.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { dealId, documents, pipeline_stage } = body || {};
    if (!dealId) return Response.json({ error: 'dealId required' }, { status: 400 });
    if (!documents && !pipeline_stage) return Response.json({ error: 'Nothing to update' }, { status: 400 });

    const profileArr = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profileArr?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    // Use get() instead of filter() by id — filter by id doesn't work reliably
    let deal;
    try {
      deal = await base44.asServiceRole.entities.Deal.get(dealId);
    } catch (e) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isInvestor = profile.user_role === 'investor';
    const isAgent = profile.user_role === 'agent';

    if (!isAdmin) {
      if (isInvestor && deal.investor_id !== profile.id) {
        return Response.json({ error: 'Access denied' }, { status: 403 });
      }
      if (isAgent) {
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
        const hasAccess = rooms.some(r => r.agent_ids?.includes(profile.id));
        const inSelected = deal.selected_agent_ids?.includes(profile.id);
        if (!hasAccess && !inSelected && deal.locked_agent_id !== profile.id) {
          return Response.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    const updatePayload = {};
    if (documents) {
      updatePayload.documents = { ...(deal.documents || {}), ...documents };
    }
    if (pipeline_stage) {
      updatePayload.pipeline_stage = pipeline_stage;
    }

    await base44.asServiceRole.entities.Deal.update(dealId, updatePayload);
    // Re-fetch to return the full merged state
    const freshDeal = await base44.asServiceRole.entities.Deal.get(dealId);
    return Response.json({ success: true, data: freshDeal });
  } catch (error) {
    console.error('[updateDealDocuments] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});