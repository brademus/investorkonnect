import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * MIGRATION: Fix existing deals where investor signed but rooms/invites weren't created
 * Finds deals with investor_signed agreements but no rooms, creates rooms and invites
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[Migration] Starting migration of signed deals to rooms...');

    // Find all agreements where investor signed
    const signedAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({});
    const investorSignedAgreements = signedAgreements.filter(a => a.investor_signed_at && !a.room_id);
    
    console.log('[Migration] Found', investorSignedAgreements.length, 'investor-signed base agreements');

    const results = {
      processed: 0,
      invites_created: 0,
      rooms_created: 0,
      errors: []
    };

    for (const agreement of investorSignedAgreements) {
      try {
        const dealId = agreement.deal_id;
        if (!dealId) continue;

        // Get the deal
        const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
        if (!deals || deals.length === 0) {
          console.log('[Migration] Deal not found:', dealId);
          continue;
        }
        const deal = deals[0];

        // Check if rooms already exist for this deal
        const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
        if (existingRooms.length > 0) {
          console.log('[Migration] Rooms already exist for deal:', dealId, ', skipping');
          continue;
        }

        // Get selected agents
        const selectedAgentIds = deal.selected_agent_ids || deal.metadata?.selected_agent_ids || [];
        
        if (selectedAgentIds.length === 0) {
          console.log('[Migration] No agents selected for deal:', dealId, ', skipping');
          results.errors.push({ dealId, error: 'No agents selected' });
          continue;
        }

        console.log('[Migration] Processing deal:', dealId, ', agents:', selectedAgentIds);

        // Call createInvitesAfterInvestorSign to create rooms and invites
        const inviteRes = await base44.asServiceRole.functions.invoke('createInvitesAfterInvestorSign', {
          deal_id: dealId
        });

        if (inviteRes.data?.ok) {
          results.processed++;
          results.invites_created += inviteRes.data.invite_ids?.length || 0;
          results.rooms_created += selectedAgentIds.length;
          console.log('[Migration] ✓ Created invites for deal:', dealId);
        } else {
          console.error('[Migration] Failed to create invites for deal:', dealId, inviteRes.data);
          results.errors.push({ dealId, error: inviteRes.data?.error || 'Unknown error' });
        }

      } catch (error) {
        console.error('[Migration] Error processing deal:', agreement.deal_id, error);
        results.errors.push({ dealId: agreement.deal_id, error: error.message });
      }
    }

    console.log('[Migration] Complete:', results);

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});