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

        // 2. AGGRESSIVE CLEANUP - Delete ALL other rooms for this investor except the locked-in one
        // This ensures no old conversations remain visible
        const allUserRooms = await base44.asServiceRole.entities.Room.filter({ investorId: myProfile.id });
        
        console.log(`[lockInDealAgent] Found ${allUserRooms.length} total rooms for investor`);
        
        // Delete ALL rooms except the one we're locking in
        const roomsToDelete = allUserRooms.filter(r => r.id !== room_id);
        
        console.log(`[lockInDealAgent] Will delete ${roomsToDelete.length} rooms`);

        // Delete rooms and their messages using service role for permissions
        for (const r of roomsToDelete) {
            try {
                const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: r.id });
                for (const m of msgs) {
                    await base44.asServiceRole.entities.Message.delete(m.id);
                }
                await base44.asServiceRole.entities.Room.delete(r.id);
                console.log(`[lockInDealAgent] Deleted room ${r.id}`);
            } catch (e) {
                console.error(`[lockInDealAgent] Error deleting room ${r.id}:`, e);
            }
        }

        // 3. Update the Deal: assign agent, set status, and move to pipeline
        await base44.asServiceRole.entities.Deal.update(deal_id, {
            agent_id: room.agentId,
            agent_name: agentProfile?.full_name || 'Agent',
            investor_id: myProfile.id,
            status: 'active',
            pipeline_stage: 'new_deal_under_contract'
        });

        // 4. Update the Target Room: convert from exploration to locked-in
        await base44.asServiceRole.entities.Room.update(room_id, {
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