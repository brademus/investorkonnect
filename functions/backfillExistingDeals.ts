import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can run backfill
    const profile = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profile[0] || profile[0].role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all deals
    const allDeals = await base44.asServiceRole.entities.Deal.filter({});
    
    let updated = 0;
    let skipped = 0;

    for (const deal of allDeals) {
      let needsUpdate = false;
      const updates = {};

      // Ensure status is set
      if (!deal.status || deal.status === '') {
        updates.status = 'active';
        needsUpdate = true;
      }

      // Ensure pipeline_stage is set
      if (!deal.pipeline_stage || deal.pipeline_stage === '') {
        updates.pipeline_stage = 'new_deal_under_contract';
        needsUpdate = true;
      }

      // Try to extract state from address if missing
      if (!deal.state && deal.property_address) {
        const parts = deal.property_address.split(',');
        if (parts.length >= 2) {
          // Usually format: "123 Main St, City, ST 12345"
          const lastPart = parts[parts.length - 1].trim();
          const match = lastPart.match(/\b([A-Z]{2})\b/);
          if (match) {
            updates.state = match[1];
            needsUpdate = true;
          }
        }
      }

      // Try to extract city if missing
      if (!deal.city && deal.property_address) {
        const parts = deal.property_address.split(',');
        if (parts.length >= 2) {
          updates.city = parts[parts.length - 2].trim();
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await base44.asServiceRole.entities.Deal.update(deal.id, updates);
        updated++;
      } else {
        skipped++;
      }
    }

    return Response.json({
      success: true,
      total: allDeals.length,
      updated,
      skipped,
      message: `Updated ${updated} deals, skipped ${skipped}`
    });

  } catch (error) {
    console.error('[backfillExistingDeals] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});