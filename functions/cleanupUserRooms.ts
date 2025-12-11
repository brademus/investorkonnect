import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Admin function to clean up orphaned/duplicate rooms for a user
 * Removes all exploration rooms (suggested_deal_id) that have no corresponding active deal
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's profile
        const myProfiles = await base44.entities.Profile.filter({ user_id: user.id });
        const myProfile = myProfiles[0];
        
        if (!myProfile) {
            return Response.json({ error: 'Profile not found' }, { status: 404 });
        }

        // Get all rooms for this user
        const allRooms = await base44.entities.Room.filter({ investorId: myProfile.id });
        
        // Get all active deals for this user
        const allDeals = await base44.entities.Deal.filter({ 
            investor_id: myProfile.id,
            status: 'active'
        });
        
        const activeDealsWithAgents = new Set(
            allDeals.filter(d => d.agent_id).map(d => d.id)
        );

        // Find rooms to delete:
        // 1. Rooms with suggested_deal_id (exploration rooms)
        // 2. Rooms where the deal has a locked-in agent but this isn't the locked-in room
        const roomsToDelete = [];
        
        for (const room of allRooms) {
            // If it's an exploration room (has suggested_deal_id)
            if (room.suggested_deal_id && !room.deal_id) {
                // Check if this deal now has a locked-in agent
                const deal = allDeals.find(d => d.id === room.suggested_deal_id);
                if (deal && deal.agent_id) {
                    // This deal is locked-in to a different agent, delete this exploration room
                    roomsToDelete.push(room);
                }
            }
            
            // If it's a room for a deal with a locked-in agent, but this room is for a different agent
            if (room.deal_id && activeDealsWithAgents.has(room.deal_id)) {
                const deal = allDeals.find(d => d.id === room.deal_id);
                if (deal && deal.agent_id && deal.agent_id !== room.agentId) {
                    roomsToDelete.push(room);
                }
            }
        }

        // Delete identified rooms and their messages
        const deletePromises = roomsToDelete.map(async (room) => {
            try {
                const msgs = await base44.entities.Message.filter({ room_id: room.id });
                await Promise.all(msgs.map(m => base44.entities.Message.delete(m.id)));
            } catch (e) {
                console.error("Error deleting messages for room " + room.id, e);
            }
            return base44.entities.Room.delete(room.id);
        });

        await Promise.all(deletePromises);

        return Response.json({ 
            success: true, 
            deleted_count: roomsToDelete.length,
            deleted_room_ids: roomsToDelete.map(r => r.id)
        });

    } catch (error) {
        console.error("cleanupUserRooms error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});