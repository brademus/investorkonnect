import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ADMIN MIGRATION: Migrate deals, agreements, and counter offers to room-scoped terms
 * - Associates agreements with rooms
 * - Associates counter offers with rooms
 * - Copies proposed_terms from deal to each room
 * - Only admin users can run this
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile || profile.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[migrateToRoomScopedTerms] Starting migration...');

    const stats = {
      agreements_migrated: 0,
      counter_offers_migrated: 0,
      rooms_updated_with_terms: 0,
      errors: []
    };

    // 1. Migrate agreements to room-scoped
    try {
      const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({});
      
      for (const agreement of agreements || []) {
        if (!agreement.room_id) {
          // Find the room for this investor-agent pair on this deal
          const rooms = await base44.asServiceRole.entities.Room.filter({
            deal_id: agreement.deal_id,
            agentId: agreement.agent_profile_id
          });

          if (rooms && rooms.length > 0) {
            const room = rooms[0];
            await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, {
              room_id: room.id
            });
            stats.agreements_migrated++;
            console.log(`[migrateToRoomScopedTerms] Agreement ${agreement.id} -> Room ${room.id}`);
          } else {
            stats.errors.push(`Agreement ${agreement.id}: No matching room found`);
          }
        }
      }
    } catch (e) {
      stats.errors.push(`Agreement migration error: ${e.message}`);
      console.error('[migrateToRoomScopedTerms] Agreement migration error:', e);
    }

    // 2. Migrate counter offers to room-scoped
    try {
      const counters = await base44.asServiceRole.entities.CounterOffer.filter({});

      for (const counter of counters || []) {
        if (!counter.room_id) {
          // Find the room for this deal
          const rooms = await base44.asServiceRole.entities.Room.filter({
            deal_id: counter.deal_id
          });

          // If from_role is agent, find the agent's room
          let targetRoom = null;
          if (counter.from_role === 'agent') {
            // Load the deal to find investor
            const deals = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
            const deal = deals?.[0];
            
            if (deal) {
              // Find room for this agent
              const agentRooms = await base44.asServiceRole.entities.Room.filter({
                deal_id: counter.deal_id,
                agentId: counter.from_profile_id || deal.agent_id
              });
              targetRoom = agentRooms?.[0];
            }
          } else if (counter.to_role === 'agent' && rooms?.length > 0) {
            // Counter FROM investor - associate with first agent room on this deal
            targetRoom = rooms[0];
          }

          if (targetRoom) {
            await base44.asServiceRole.entities.CounterOffer.update(counter.id, {
              room_id: targetRoom.id
            });
            stats.counter_offers_migrated++;
            console.log(`[migrateToRoomScopedTerms] Counter ${counter.id} -> Room ${targetRoom.id}`);
          } else {
            stats.errors.push(`Counter ${counter.id}: No matching room found`);
          }
        }
      }
    } catch (e) {
      stats.errors.push(`Counter offer migration error: ${e.message}`);
      console.error('[migrateToRoomScopedTerms] Counter offer migration error:', e);
    }

    // 3. Copy deal proposed_terms to each room that doesn't have them
    try {
      const deals = await base44.asServiceRole.entities.Deal.filter({});

      for (const deal of deals || []) {
        if (deal.proposed_terms) {
          // Get all rooms for this deal
          const rooms = await base44.asServiceRole.entities.Room.filter({
            deal_id: deal.id
          });

          for (const room of rooms || []) {
            if (!room.proposed_terms) {
              await base44.asServiceRole.entities.Room.update(room.id, {
                proposed_terms: deal.proposed_terms
              });
              stats.rooms_updated_with_terms++;
              console.log(`[migrateToRoomScopedTerms] Room ${room.id} <- Deal terms`);
            }
          }
        }
      }
    } catch (e) {
      stats.errors.push(`Room terms copy error: ${e.message}`);
      console.error('[migrateToRoomScopedTerms] Room terms copy error:', e);
    }

    console.log('[migrateToRoomScopedTerms] Migration complete:', stats);

    return Response.json({
      success: true,
      message: 'Migration completed',
      stats
    });
  } catch (error) {
    console.error('[migrateToRoomScopedTerms] Fatal error:', error);
    return Response.json({
      error: error?.message || 'Migration failed'
    }, { status: 500 });
  }
});