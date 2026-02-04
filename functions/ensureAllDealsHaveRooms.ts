import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Migration function: Ensure all active deals have rooms for their selected agents
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all active deals
    const allDeals = await base44.asServiceRole.entities.Deal.filter({ 
      status: 'active' 
    });

    console.log(`[ensureAllDealsHaveRooms] Found ${allDeals.length} active deals`);

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const deal of allDeals) {
      try {
        // Skip if no selected agents
        if (!deal.selected_agent_ids || !Array.isArray(deal.selected_agent_ids) || deal.selected_agent_ids.length === 0) {
          console.log(`[ensureAllDealsHaveRooms] Skipping deal ${deal.id} - no selected agents`);
          skipped++;
          continue;
        }

        // Check if rooms exist for this deal
        const existingRooms = await base44.asServiceRole.entities.Room.filter({ 
          deal_id: deal.id 
        });

        if (existingRooms.length > 0) {
          console.log(`[ensureAllDealsHaveRooms] Deal ${deal.id} already has ${existingRooms.length} room(s)`);
          skipped++;
          continue;
        }

        // Create room for each agent
        for (const agentProfileId of deal.selected_agent_ids) {
          try {
            // Get agent profile
            const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ 
              id: agentProfileId 
            });
            const agentProfile = agentProfiles[0];

            if (!agentProfile) {
              console.warn(`[ensureAllDealsHaveRooms] Agent profile not found: ${agentProfileId}`);
              continue;
            }

            // Create room
            const room = await base44.asServiceRole.entities.Room.create({
              deal_id: deal.id,
              investorId: deal.investor_id,
              agent_ids: [agentProfileId],
              title: deal.title || `${deal.city || 'City'}, ${deal.state || 'State'}`,
              property_address: deal.property_address,
              city: deal.city,
              state: deal.state,
              county: deal.county,
              zip: deal.zip,
              budget: deal.purchase_price,
              closing_date: deal.key_dates?.closing_date,
              contract_url: deal.contract_url,
              request_status: 'requested',
              agreement_status: 'draft',
              requested_at: new Date().toISOString(),
              agent_terms: {
                [agentProfileId]: deal.proposed_terms || {}
              },
              files: [],
              photos: []
            });

            // Create DealInvite
            await base44.asServiceRole.entities.DealInvite.create({
              deal_id: deal.id,
              investor_id: deal.investor_id,
              agent_profile_id: agentProfileId,
              room_id: room.id,
              legal_agreement_id: deal.current_legal_agreement_id || '',
              status: 'PENDING_AGENT_SIGNATURE',
              created_at_iso: new Date().toISOString()
            });

            console.log(`[ensureAllDealsHaveRooms] Created room ${room.id} for deal ${deal.id} and agent ${agentProfileId}`);
            created++;
          } catch (e) {
            console.error(`[ensureAllDealsHaveRooms] Error creating room for agent ${agentProfileId}:`, e);
            errors.push({ dealId: deal.id, agentId: agentProfileId, error: e.message });
          }
        }
      } catch (e) {
        console.error(`[ensureAllDealsHaveRooms] Error processing deal ${deal.id}:`, e);
        errors.push({ dealId: deal.id, error: e.message });
      }
    }

    return Response.json({
      success: true,
      totalDeals: allDeals.length,
      roomsCreated: created,
      dealsSkipped: skipped,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[ensureAllDealsHaveRooms] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});