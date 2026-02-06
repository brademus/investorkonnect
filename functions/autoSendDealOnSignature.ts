import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Triggered when investor signs agreement
 * Automatically sends deal to agent by creating a Room with 'requested' status
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    console.log('[autoSendDealOnSignature] Event:', event.type, 'Agreement ID:', event.entity_id);

    if (event.type !== 'update' || !data?.investor_signed_at) {
      console.log('[autoSendDealOnSignature] Skipping - not an investor signature');
      return Response.json({ ok: true });
    }

    const agreement = data;
    const dealId = agreement.deal_id;

    if (!dealId) {
      console.error('[autoSendDealOnSignature] No deal_id in agreement');
      return Response.json({ ok: true });
    }

    // Get deal to find agent
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = deals?.[0];

    if (!deal || !deal.agent_id) {
      console.log('[autoSendDealOnSignature] Deal not found or no agent assigned:', dealId);
      return Response.json({ ok: true });
    }

    console.log('[autoSendDealOnSignature] Sending deal', dealId, 'to agent', deal.agent_id);

    // Check if Room already exists for this deal+agent
    const existingRooms = await base44.asServiceRole.entities.Room.filter({
      deal_id: dealId,
      agentId: deal.agent_id
    });

    if (existingRooms && existingRooms.length > 0) {
      console.log('[autoSendDealOnSignature] Room already exists, skipping');
      return Response.json({ ok: true });
    }

    // Create Room with 'requested' status - populate all fields from deal
    const room = await base44.asServiceRole.entities.Room.create({
      deal_id: dealId,
      investorId: deal.investor_id,
      agentId: deal.agent_id,
      request_status: 'requested',
      requested_at: new Date().toISOString(),
      title: deal.title,
      property_address: deal.property_address,
      city: deal.city,
      state: deal.state,
      county: deal.county,
      zip: deal.zip,
      budget: deal.purchase_price,
      closing_date: deal.key_dates?.closing_date,
      contract_url: deal.contract_url,
      contract_document: deal.contract_document,
      proposed_terms: deal.proposed_terms,
      agreement_status: 'draft'
    });

    console.log('[autoSendDealOnSignature] Room created:', room.id);

    // Log activity
    try {
      const activities = await base44.asServiceRole.entities.Activity.filter({ deal_id: dealId }, '-created_date', 1);
      const lastActivity = activities?.[0];

      await base44.asServiceRole.entities.Activity.create({
        type: 'agent_locked_in',
        deal_id: dealId,
        room_id: room.id,
        actor_id: deal.investor_id,
        actor_name: 'System',
        message: `Deal automatically sent to agent after signature`
      });
    } catch (e) {
      console.warn('[autoSendDealOnSignature] Failed to log activity (non-blocking):', e.message);
    }

    return Response.json({ ok: true, room_id: room.id });
  } catch (error) {
    console.error('[autoSendDealOnSignature] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});