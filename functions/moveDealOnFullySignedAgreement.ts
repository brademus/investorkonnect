import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Triggered when agreement is fully signed by both parties
 * Moves deal from new_listings to active_listings in pipeline
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    console.log('[moveDealOnFullySignedAgreement] Event:', event.type, 'Agreement ID:', event.entity_id);

    // Only trigger on fully_signed status
    if (event.type !== 'update' || data?.status !== 'fully_signed') {
      console.log('[moveDealOnFullySignedAgreement] Skipping - not fully signed');
      return Response.json({ ok: true });
    }

    const agreement = data;
    const dealId = agreement.deal_id;

    if (!dealId) {
      console.error('[moveDealOnFullySignedAgreement] No deal_id in agreement');
      return Response.json({ ok: true });
    }

    // Get deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = deals?.[0];

    if (!deal) {
      console.log('[moveDealOnFullySignedAgreement] Deal not found:', dealId);
      return Response.json({ ok: true });
    }

    console.log('[moveDealOnFullySignedAgreement] Moving deal', dealId, 'from', deal.pipeline_stage, 'to active_listings');

    // Move deal to active_listings stage
    await base44.asServiceRole.entities.Deal.update(dealId, {
      pipeline_stage: 'active_listings'
    });

    console.log('[moveDealOnFullySignedAgreement] Deal moved to active_listings');

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[moveDealOnFullySignedAgreement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});