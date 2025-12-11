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

        // Get user's profile to verify they're the investor
        const myProfiles = await base44.entities.Profile.filter({ user_id: user.id });
        const myProfile = myProfiles[0];
        
        if (!myProfile) {
            return Response.json({ error: 'Profile not found' }, { status: 404 });
        }
        
        // Verify user is the investor in this room
        if (room.investorId !== myProfile.id) {
             return Response.json({ error: 'Only the investor can lock in an agent' }, { status: 403 });
        }

        // Fetch agent profile to get their name
        const agentProfiles = await base44.entities.Profile.filter({ id: room.agentId });
        const agentProfile = agentProfiles[0];

        // 2. FIRST - Delete ALL exploration rooms for this deal (before updating)
        // Get ALL rooms for this investor
        const allUserRooms = await base44.entities.Room.filter({ investorId: myProfile.id });
        
        // Find all rooms related to this deal (except the one we're locking in)
        const roomsToDelete = allUserRooms.filter(r => 
            r.id !== room_id && (
              r.deal_id === deal_id || 
              r.suggested_deal_id === deal_id
            )
        );

        // Delete all exploration rooms and their messages
        const deletePromises = roomsToDelete.map(async (r) => {
            try {
                const msgs = await base44.entities.Message.filter({ room_id: r.id });
                await Promise.all(msgs.map(m => base44.entities.Message.delete(m.id)));
            } catch (e) {
                console.error("Error deleting messages for room " + r.id, e);
            }
            return base44.entities.Room.delete(r.id);
        });

        await Promise.all(deletePromises);

        // 3. Update the Deal: assign agent, set status, and move to pipeline
        await base44.entities.Deal.update(deal_id, {
            agent_id: room.agentId,
            agent_name: agentProfile?.full_name || 'Agent',
            investor_id: myProfile.id,
            status: 'active',
            pipeline_stage: 'new_deal_under_contract'
        });

        // 4. Update the Target Room: convert from exploration to locked-in
        await base44.entities.Room.update(room_id, {
            deal_id: deal_id,
            suggested_deal_id: null, // Clear the suggested flag
            investorId: myProfile.id,
            agentId: room.agentId
        });

        return Response.json({ 
            success: true, 
            deleted_count: roomsToDelete.length,
            agent_name: agentProfile?.full_name || 'Agent'
        });

    } catch (error) {
        console.error("lockInDealAgent error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});