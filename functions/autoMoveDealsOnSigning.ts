import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Automatically moves deals to "Connected Deals" pipeline stage
 * when the agreement is fully signed (both investor and agent signed).
 * 
 * Called by docusignWebhook when an agreement reaches fully_signed status.
 * Also can be invoked as a standalone function for backfilling.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // If called with deal_id parameter, move a specific deal
    const body = await req.json().catch(() => ({}));
    const dealId = body.deal_id;

    if (dealId) {
      // Single deal move
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
      if (!deals || !deals.length) {
        return Response.json({ error: 'Deal not found' }, { status: 404 });
      }

      const deal = deals[0];
      
      // Check if agreement is fully signed
      try {
        const agreements = await base44.asServiceRole.entities.AgreementVersion.filter({ deal_id: dealId, status: 'fully_signed' });
        const legacyAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: dealId, status: 'fully_signed' });
        
        const isFullySigned = (agreements && agreements.length > 0) || (legacyAgreements && legacyAgreements.length > 0);
        
        if (isFullySigned && deal.pipeline_stage !== 'connected_deals') {
          await base44.asServiceRole.entities.Deal.update(dealId, { pipeline_stage: 'connected_deals' });
          console.log(`[autoMoveDealsOnSigning] Moved deal ${dealId} to connected_deals`);
          return Response.json({ success: true, message: 'Deal moved to connected_deals' });
        } else if (!isFullySigned) {
          return Response.json({ success: false, message: 'Agreement not fully signed' }, { status: 400 });
        } else {
          return Response.json({ success: true, message: 'Deal already in connected_deals' });
        }
      } catch (error) {
        console.error('[autoMoveDealsOnSigning] Error checking agreement:', error);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // If no deal_id, this is a backfill operation (admin only)
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Backfill: find all fully signed deals not in connected_deals
    const allDeals = await base44.asServiceRole.entities.Deal.list('-updated_date', 10000);
    let movedCount = 0;

    for (const deal of allDeals) {
      if (deal.pipeline_stage === 'connected_deals') continue; // Skip if already moved

      try {
        const versions = await base44.asServiceRole.entities.AgreementVersion.filter({ deal_id: deal.id, status: 'fully_signed' });
        const legacyAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal.id, status: 'fully_signed' });

        if ((versions && versions.length > 0) || (legacyAgreements && legacyAgreements.length > 0)) {
          await base44.asServiceRole.entities.Deal.update(deal.id, { pipeline_stage: 'connected_deals' });
          movedCount++;
        }
      } catch (error) {
        console.warn(`[autoMoveDealsOnSigning] Failed to process deal ${deal.id}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      message: `Backfill complete: moved ${movedCount} deals to connected_deals`
    });

  } catch (error) {
    console.error('[autoMoveDealsOnSigning] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});