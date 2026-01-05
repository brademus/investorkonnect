import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Ensure all existing deals have their county field properly set
 * This fixes any deals where county might have been set to empty string
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all deals
    const deals = await base44.asServiceRole.entities.Deal.list();
    
    let updated = 0;
    let skipped = 0;

    for (const deal of deals) {
      // If county exists and is not just whitespace, keep it as is
      // If county is empty string or just whitespace, set to null for consistency
      if (deal.county === "" || (typeof deal.county === 'string' && deal.county.trim() === "")) {
        // Only update if it's explicitly empty string, not if it's undefined/null
        if (deal.county === "") {
          await base44.asServiceRole.entities.Deal.update(deal.id, {
            county: null
          });
          updated++;
        }
      } else {
        skipped++;
      }
    }

    return Response.json({
      success: true,
      message: `County field migration complete`,
      stats: {
        total: deals.length,
        updated: updated,
        skipped: skipped
      }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({
      error: error.message,
      success: false
    }, { status: 500 });
  }
});