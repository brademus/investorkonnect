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

    let deal;
    try {
      deal = await base44.asServiceRole.entities.Deal.get(dealId);
    } catch (e) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    // Access control
    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    if (!isAdmin) {
      const isInvestor = profile.user_role === 'investor';
      const isAgent = profile.user_role === 'agent';
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
      // Block moving back to new_deals once a deal has left that stage
      const STAGE_ORDER = { new_deals: 1, connected_deals: 2, active_listings: 3, in_closing: 4, completed: 5, canceled: 6 };
      const currentOrder = STAGE_ORDER[deal.pipeline_stage] || 1;
      if (pipeline_stage === 'new_deals' && currentOrder > 1) {
        return Response.json({ error: 'Deals cannot be moved back to New Deals.' }, { status: 400 });
      }
      // Block moving to connected_deals or beyond unless agreement is fully signed
      const targetOrder = STAGE_ORDER[pipeline_stage] || 0;
      if (targetOrder >= 2) {
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
        const hasFulySigned = rooms.some(r => r.agreement_status === 'fully_signed' || r.request_status === 'locked');
        if (!hasFulySigned && !deal.locked_agent_id) {
          return Response.json({ error: 'Agreement must be fully signed before moving this deal forward.' }, { status: 400 });
        }
      }
      updatePayload.pipeline_stage = pipeline_stage;
    }

    await base44.asServiceRole.entities.Deal.update(dealId, updatePayload);
    const freshDeal = await base44.asServiceRole.entities.Deal.get(dealId);
    return Response.json({ success: true, data: freshDeal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});