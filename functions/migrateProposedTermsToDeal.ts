import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Migration: Normalize and sync proposed_terms across Deal and Room entities
 * Handles both old and new field name structures
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allDeals = await base44.asServiceRole.entities.Deal.list();
    
    let migratedCount = 0;
    let skippedCount = 0;
    let fixedCount = 0;
    
    for (const deal of allDeals) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
      
      if (rooms.length === 0) {
        skippedCount++;
        continue;
      }
      
      const room = rooms[0];
      let normalizedTerms = null;
      
      // Check if Room has OLD structure (commission_type, commission_percentage, flat_fee)
      if (room.proposed_terms && room.proposed_terms.commission_type) {
        console.log(`Converting old Room structure for deal ${deal.id}`);
        normalizedTerms = {
          seller_commission_type: room.proposed_terms.commission_type || "percentage",
          seller_commission_percentage: room.proposed_terms.commission_percentage || null,
          seller_flat_fee: room.proposed_terms.flat_fee || null,
          buyer_commission_type: room.proposed_terms.commission_type || "percentage",
          buyer_commission_percentage: room.proposed_terms.commission_percentage || null,
          buyer_flat_fee: room.proposed_terms.flat_fee || null,
          agreement_length: room.proposed_terms.agreement_length || null
        };
      } 
      // Check if Room has NEW structure but Deal doesn't
      else if (room.proposed_terms && room.proposed_terms.seller_commission_type) {
        normalizedTerms = room.proposed_terms;
      }
      
      // Update both Deal and Room with normalized structure
      if (normalizedTerms) {
        await base44.asServiceRole.entities.Deal.update(deal.id, {
          proposed_terms: normalizedTerms
        });
        
        await base44.asServiceRole.entities.Room.update(room.id, {
          proposed_terms: normalizedTerms
        });
        
        migratedCount++;
        console.log(`Fixed terms for deal ${deal.id}`);
      } else {
        // Set default values if no terms exist
        const defaultTerms = {
          seller_commission_type: "percentage",
          seller_commission_percentage: 3.0,
          seller_flat_fee: null,
          buyer_commission_type: "percentage",
          buyer_commission_percentage: 3.0,
          buyer_flat_fee: null,
          agreement_length: 90
        };
        
        await base44.asServiceRole.entities.Deal.update(deal.id, {
          proposed_terms: defaultTerms
        });
        
        await base44.asServiceRole.entities.Room.update(room.id, {
          proposed_terms: defaultTerms
        });
        
        fixedCount++;
        console.log(`Set default terms for deal ${deal.id}`);
      }
    }

    return Response.json({
      success: true,
      migratedCount,
      fixedCount,
      skippedCount,
      totalDeals: allDeals.length
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});