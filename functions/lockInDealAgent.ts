import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { room_id, deal_id } = await req.json();

        if (!room_id || !deal_id) {
            return Response.json({ error: 'Missing room_id or deal_id' }, { status: 400 });
        }

        // 1. Fetch the target room to verify ownership and get agentId
        const rooms = await base44.entities.Room.filter({ id: room_id });
        const room = rooms[0];

        if (!room) {
            return Response.json({ error: 'Room not found' }, { status: 404 });
        }

        // Verify user is the investor in this room (since they are locking in an agent)
        if (room.investorId !== user.id) {
             return Response.json({ error: 'Only the investor can lock in an agent' }, { status: 403 });
        }

        // 2. Update the Deal: assign agent and set status
        await base44.entities.Deal.update(deal_id, {
            agent_id: room.agentId,
            pipeline_stage: 'new_deal_under_contract', // Set to initial stage if needed, or keep existing
            status: 'active'
        });

        // 3. Update the Target Room: link to deal
        await base44.entities.Room.update(room_id, {
            deal_id: deal_id
        });

        // 4. Cleanup: Delete OTHER rooms for this investor that are unassigned (potential auditions)
        // We look for rooms where:
        // - investorId is current user
        // - id is NOT the current room_id
        // - deal_id is NULL/undefined (not linked to another valid deal)
        // - agentId exists (it's an agent chat, not internal/support)
        
        const allUserRooms = await base44.entities.Room.filter({ investorId: user.id });
        
        const roomsToDelete = allUserRooms.filter(r => 
            r.id !== room_id && 
            r.agentId && 
            !r.deal_id
        );

        const deletePromises = roomsToDelete.map(async (r) => {
            // Delete messages for this room first (optional but good for cleanup)
            // Note: Entity SDK might not support bulk delete by query for some entities yet, so we iterate or let it be.
            // Assuming we just delete the room for now, or fetch messages and delete.
            // Let's try to delete messages if possible to keep DB clean.
            try {
                const msgs = await base44.entities.Message.filter({ room_id: r.id });
                await Promise.all(msgs.map(m => base44.entities.Message.delete(m.id)));
            } catch (e) {
                console.error("Error deleting messages for room " + r.id, e);
            }
            
            // Delete the room
            return base44.entities.Room.delete(r.id);
        });

        await Promise.all(deletePromises);

        return Response.json({ 
            success: true, 
            deleted_count: roomsToDelete.length 
        });

    } catch (error) {
        console.error("lockInDealAgent error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});