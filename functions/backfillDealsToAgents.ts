import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin function to backfill existing signed agreements
 * Creates Room entries for deals that have signed agreements but no Room yet
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('[backfillDealsToAgents] Starting backfill...');

    // Get all signed agreements
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter(
      { investor_signed_at: { $exists: true } },
      '-created_date',
      1000
    );

    console.log('[backfillDealsToAgents] Found', agreements.length, 'signed agreements');

    let created = 0;
    let skipped = 0;

    for (const agreement of agreements) {
      if (!agreement.deal_id) {
        console.log('[backfillDealsToAgents] Skipping - no deal_id');
        skipped++;
        continue;
      }

      // Get deal
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
      const deal = deals?.[0];

      if (!deal || !deal.agent_id) {
        console.log('[backfillDealsToAgents] Skipping deal', agreement.deal_id, '- no agent assigned');
        skipped++;
        continue;
      }

      // Check if Room already exists
      const existingRooms = await base44.asServiceRole.entities.Room.filter({
        deal_id: agreement.deal_id,
        agentId: deal.agent_id
      });

      if (existingRooms && existingRooms.length > 0) {
        console.log('[backfillDealsToAgents] Room already exists for deal', agreement.deal_id);
        skipped++;
        continue;
      }

      // Create Room
      try {
        const room = await base44.asServiceRole.entities.Room.create({
          deal_id: agreement.deal_id,
          investorId: deal.investor_id,
          agentId: deal.agent_id,
          request_status: 'requested',
          requested_at: new Date().toISOString(),
          title: deal.title,
          property_address: deal.property_address,
          city: deal.city,
          state: deal.state,
          county: deal.county,
          zip: deal.zip,
          budget: deal.purchase_price,
          closing_date: deal.key_dates?.closing_date
        });

        console.log('[backfillDealsToAgents] Created room', room.id, 'for deal', agreement.deal_id);
        created++;
      } catch (e) {
        console.error('[backfillDealsToAgents] Failed to create room for deal', agreement.deal_id, ':', e.message);
        skipped++;
      }
    }

    console.log('[backfillDealsToAgents] Complete: created', created, 'rooms, skipped', skipped);

    return Response.json({ 
      ok: true, 
      created, 
      skipped, 
      total: agreements.length 
    });
  } catch (error) {
    console.error('[backfillDealsToAgents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});