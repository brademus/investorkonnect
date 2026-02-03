import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const cutoffISO = twentyFourHoursAgo.toISOString();
    
    // Find all draft deals older than 24 hours
    const allDeals = await base44.asServiceRole.entities.Deal.list();
    const abandonedDrafts = allDeals.filter(deal => 
      deal.status === 'draft' && 
      deal.created_date < cutoffISO
    );
    
    if (abandonedDrafts.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No abandoned draft deals to clean up' 
      });
    }
    
    let deletedCount = 0;
    
    // Delete each abandoned draft deal
    for (const deal of abandonedDrafts) {
      try {
        // Double-check status hasn't changed
        const freshDeals = await base44.asServiceRole.entities.Deal.filter({ id: deal.id });
        if (freshDeals.length === 0 || freshDeals[0].status !== 'draft') {
          continue;
        }
        
        // Delete the draft deal
        await base44.asServiceRole.entities.Deal.delete(deal.id);
        deletedCount++;
        
        console.log(`[cleanupAbandonedDraftDeals] Deleted abandoned draft: ${deal.id} (${deal.title || 'Untitled'})`);
      } catch (error) {
        console.error(`[cleanupAbandonedDraftDeals] Failed to delete deal ${deal.id}:`, error);
      }
    }
    
    return Response.json({ 
      success: true, 
      message: `Cleaned up ${deletedCount} abandoned draft deal(s)`,
      deleted_count: deletedCount,
      found_count: abandonedDrafts.length
    });
    
  } catch (error) {
    console.error('Error cleaning up abandoned draft deals:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});