import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * FORCE cleanup - deletes ALL rooms except those with locked-in agents
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

        // Get all deals with locked-in agents
        const allDeals = await base44.asServiceRole.entities.Deal.filter({ 
            investor_id: myProfile.id,
            status: 'active'
        });
        
        // Get locked-in room IDs (deal_id + agent_id pairs)
        const lockedInPairs = new Set();
        for (const deal of allDeals) {
            if (deal.agent_id) {
                lockedInPairs.add(`${deal.id}-${deal.agent_id}`);
            }
        }

        // Get ALL rooms for this user
        const allRooms = await base44.asServiceRole.entities.Room.filter({ investorId: myProfile.id });
        
        console.log(`[forceCleanup] Found ${allRooms.length} total rooms`);
        console.log(`[forceCleanup] Locked-in deals: ${lockedInPairs.size}`);

        // Delete rooms that don't match a locked-in deal
        const deleted = [];
        for (const room of allRooms) {
            const pairKey = `${room.deal_id}-${room.agentId}`;
            const isLockedIn = lockedInPairs.has(pairKey);
            
            if (!isLockedIn) {
                try {
                    // Delete messages first
                    const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: room.id });
                    for (const m of msgs) {
                        await base44.asServiceRole.entities.Message.delete(m.id);
                    }
                    
                    // Delete room
                    await base44.asServiceRole.entities.Room.delete(room.id);
                    deleted.push(room.id);
                    console.log(`[forceCleanup] Deleted room ${room.id}`);
                } catch (e) {
                    console.error(`[forceCleanup] Error deleting room ${room.id}:`, e);
                }
            }
        }

        return Response.json({ 
            success: true, 
            total_rooms: allRooms.length,
            locked_in_count: lockedInPairs.size,
            deleted_count: deleted.length,
            deleted_room_ids: deleted
        });

    } catch (error) {
        console.error("forceCleanupRooms error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});