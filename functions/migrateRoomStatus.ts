import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * migrateRoomStatus - One-time migration to convert old deal_status to new request_status
 * Can be called manually or automatically
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all rooms
    const allRooms = await base44.asServiceRole.entities.Room.list();
    
    let migrated = 0;
    let skipped = 0;

    for (const room of allRooms) {
      // Skip if already has request_status
      if (room.request_status) {
        skipped++;
        continue;
      }

      // Map old deal_status to new request_status
      let newStatus = 'requested'; // default
      
      if (room.deal_status === 'pending_agent_review') {
        newStatus = 'requested';
      } else if (room.deal_status === 'active') {
        newStatus = 'accepted';
      } else if (room.deal_status === 'rejected') {
        newStatus = 'rejected';
      } else if (room.internal_agreement_status === 'both_signed') {
        newStatus = 'signed';
      }

      // Update room with new status
      await base44.asServiceRole.entities.Room.update(room.id, {
        request_status: newStatus,
        requested_at: room.requested_at || room.created_date,
        accepted_at: room.accepted_at || (newStatus === 'accepted' || newStatus === 'signed' ? room.created_date : null),
        signed_at: room.signed_at || (newStatus === 'signed' ? room.created_date : null),
        rejected_at: room.rejected_at || (newStatus === 'rejected' ? room.closedAt : null)
      });

      migrated++;
    }

    return Response.json({ 
      success: true,
      migrated,
      skipped,
      total: allRooms.length
    });

  } catch (error) {
    console.error('[migrateRoomStatus] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});