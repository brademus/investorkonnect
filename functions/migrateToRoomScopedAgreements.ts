import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * MIGRATION: Migrate existing deal-scoped agreements and counter offers to room-scoped structure
 * - Ensures all deals with rooms have room-scoped agreement pointers
 * - Syncs proposed_terms from deal to rooms
 * - Updates counter offers to be room-scoped
 * - Admin-only function
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
    const profile = profiles?.[0];
    if (!profile || profile.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[migrateToRoomScopedAgreements] Starting migration...');
    
    let migratedRooms = 0;
    let migratedAgreements = 0;
    let migratedCounters = 0;

    // 1. Fetch all rooms
    const allRooms = await base44.asServiceRole.entities.Room.list();
    console.log(`[migrateToRoomScopedAgreements] Found ${allRooms.length} rooms`);

    // 2. For each room, ensure it has proposed_terms and agreement pointer
    for (const room of allRooms) {
      try {
        // If room doesn't have proposed_terms, fetch from deal
        if (!room.proposed_terms && room.deal_id) {
          const deals = await base44.asServiceRole.entities.Deal.filter({ id: room.deal_id });
          const deal = deals?.[0];
          
          if (deal?.proposed_terms) {
            // Sync deal-level terms to room
            await base44.asServiceRole.entities.Room.update(room.id, {
              proposed_terms: deal.proposed_terms
            });
            migratedRooms++;
            console.log(`[migrateToRoomScopedAgreements] Synced terms to room ${room.id}`);
          }
        }

        // If room doesn't have current_legal_agreement_id but deal does, try to link or create room-scoped agreement
        if (!room.current_legal_agreement_id && room.deal_id) {
          const deals = await base44.asServiceRole.entities.Deal.filter({ id: room.deal_id });
          const deal = deals?.[0];
          
          if (deal?.current_legal_agreement_id) {
            // Try to find or create a room-scoped agreement
            const existingRoomAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({
              deal_id: room.deal_id,
              room_id: room.id
            });
            
            if (existingRoomAgreements.length === 0) {
              // No room-scoped agreement yet - link to deal-scoped one for now
              // (actual room-scoped agreements will be created when regenerated after counter)
              await base44.asServiceRole.entities.Room.update(room.id, {
                current_legal_agreement_id: deal.current_legal_agreement_id
              });
              migratedAgreements++;
              console.log(`[migrateToRoomScopedAgreements] Linked agreement to room ${room.id}`);
            } else {
              // Already has room-scoped agreement
              await base44.asServiceRole.entities.Room.update(room.id, {
                current_legal_agreement_id: existingRoomAgreements[0].id
              });
              console.log(`[migrateToRoomScopedAgreements] Found existing room-scoped agreement for room ${room.id}`);
            }
          }
        }
      } catch (e) {
        console.error(`[migrateToRoomScopedAgreements] Error processing room ${room.id}:`, e.message);
      }
    }

    // 3. Scope counter offers to rooms
    const allCounters = await base44.asServiceRole.entities.CounterOffer.list();
    for (const counter of allCounters) {
      try {
        // If counter doesn't have room_id, try to find the room and link it
        if (!counter.room_id && counter.deal_id) {
          const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: counter.deal_id });
          
          // If there's only one room, scope to it
          if (rooms.length === 1) {
            await base44.asServiceRole.entities.CounterOffer.update(counter.id, {
              room_id: rooms[0].id
            });
            migratedCounters++;
            console.log(`[migrateToRoomScopedAgreements] Scoped counter ${counter.id} to room ${rooms[0].id}`);
          }
        }
      } catch (e) {
        console.error(`[migrateToRoomScopedAgreements] Error processing counter ${counter.id}:`, e.message);
      }
    }

    console.log('[migrateToRoomScopedAgreements] Migration complete');
    return Response.json({
      success: true,
      stats: {
        rooms_migrated: migratedRooms,
        agreements_linked: migratedAgreements,
        counters_scoped: migratedCounters,
        total_rooms: allRooms.length,
        total_counters: allCounters.length
      }
    });
  } catch (error) {
    console.error('[migrateToRoomScopedAgreements] Fatal error:', error);
    return Response.json({
      error: error.message || 'Migration failed'
    }, { status: 500 });
  }
});