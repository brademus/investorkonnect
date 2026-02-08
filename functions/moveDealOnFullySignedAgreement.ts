import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Triggered on LegalAgreement update.
 * When agent_only agreement becomes fully_signed, the docusignWebhook
 * already handles lock-in. This just ensures pipeline_stage is correct.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (event.type !== 'update' || data?.status !== 'fully_signed') {
      return Response.json({ ok: true });
    }

    // Skip if already was fully_signed
    if (old_data?.status === 'fully_signed') {
      return Response.json({ ok: true });
    }

    const dealId = data.deal_id;
    if (!dealId) return Response.json({ ok: true });

    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = deals?.[0];
    if (!deal) return Response.json({ ok: true });

    // Only move if not already in connected_deals or later
    if (deal.pipeline_stage === 'connected_deals' || deal.pipeline_stage === 'in_closing' || deal.pipeline_stage === 'completed') {
      console.log('[moveDeal] Deal already in', deal.pipeline_stage, '- skipping');
      return Response.json({ ok: true });
    }

    console.log('[moveDeal] Moving deal', dealId, 'from', deal.pipeline_stage, 'to connected_deals');
    await base44.asServiceRole.entities.Deal.update(dealId, {
      pipeline_stage: 'connected_deals'
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[moveDeal] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});