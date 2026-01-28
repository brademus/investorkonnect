import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Backfill investor_id and agent_id on existing deals based on LegalAgreement data
 * Admin-only endpoint
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[backfillDealParticipants] Starting backfill...');
    
    // Get all deals
    const deals = await base44.asServiceRole.entities.Deal.list();
    console.log('[backfillDealParticipants] Found', deals.length, 'deals');
    
    let updatedCount = 0;
    const errors = [];
    
    for (const deal of deals) {
      try {
        let needsUpdate = false;
        const updates = {};
        
        // Check if investor_id is missing
        if (!deal.investor_id) {
          // Try to find from LegalAgreement
          const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal.id });
          if (agreements && agreements.length > 0) {
            const agreement = agreements[0];
            if (agreement.investor_profile_id) {
              updates.investor_id = agreement.investor_profile_id;
              needsUpdate = true;
              console.log('[backfillDealParticipants] Setting investor_id for deal', deal.id, 'from agreement');
            }
          }
          
          // Fallback: check who created the deal
          if (!updates.investor_id) {
            const profiles = await base44.asServiceRole.entities.Profile.filter({ email: deal.created_by });
            if (profiles && profiles.length > 0 && profiles[0].user_role === 'investor') {
              updates.investor_id = profiles[0].id;
              needsUpdate = true;
              console.log('[backfillDealParticipants] Setting investor_id for deal', deal.id, 'from created_by');
            }
          }
        }
        
        // Check if agent_id is missing
        if (!deal.agent_id) {
          // Try to find from LegalAgreement
          const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal.id });
          if (agreements && agreements.length > 0) {
            const agreement = agreements[0];
            if (agreement.agent_profile_id) {
              updates.agent_id = agreement.agent_profile_id;
              needsUpdate = true;
              console.log('[backfillDealParticipants] Setting agent_id for deal', deal.id, 'from agreement');
            }
          }
          
          // Fallback: check Room
          if (!updates.agent_id) {
            const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
            if (rooms && rooms.length > 0 && rooms[0].agentId) {
              updates.agent_id = rooms[0].agentId;
              needsUpdate = true;
              console.log('[backfillDealParticipants] Setting agent_id for deal', deal.id, 'from room');
            }
          }
        }
        
        if (needsUpdate) {
          await base44.asServiceRole.entities.Deal.update(deal.id, updates);
          updatedCount++;
          console.log('[backfillDealParticipants] Updated deal', deal.id, 'with', updates);
        }
      } catch (error) {
        console.error('[backfillDealParticipants] Error updating deal', deal.id, ':', error);
        errors.push({ deal_id: deal.id, error: error.message });
      }
    }
    
    return Response.json({ 
      success: true,
      total_deals: deals.length,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    console.error('[backfillDealParticipants] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});