import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Migration: Copy proposed_terms from Room to Deal entity
 * This ensures all existing deals have their terms saved directly on the Deal entity
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all deals that don't have proposed_terms yet
    const allDeals = await base44.asServiceRole.entities.Deal.list();
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const deal of allDeals) {
      // Skip if already has proposed_terms
      if (deal.proposed_terms) {
        skippedCount++;
        continue;
      }
      
      // Find associated Room
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
      if (rooms.length > 0 && rooms[0].proposed_terms) {
        // Copy terms from Room to Deal
        await base44.asServiceRole.entities.Deal.update(deal.id, {
          proposed_terms: rooms[0].proposed_terms
        });
        migratedCount++;
        console.log(`Migrated terms for deal ${deal.id}`);
      }
    }

    return Response.json({
      success: true,
      migratedCount,
      skippedCount,
      totalDeals: allDeals.length
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});