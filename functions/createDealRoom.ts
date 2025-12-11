import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { deal_id, agent_id } = body;

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        if (!profiles.length) {
            return Response.json({ error: 'Profile not found' }, { status: 404 });
        }
        const investorProfile = profiles[0];

        // Get deal to verify ownership
        const deals = await base44.entities.Deal.filter({ id: deal_id });
        if (!deals.length) {
            return Response.json({ error: 'Deal not found' }, { status: 404 });
        }
        const deal = deals[0];
        
        if (deal.investor_id !== investorProfile.id) {
            return Response.json({ error: 'Not authorized for this deal' }, { status: 403 });
        }

        // Check if room already exists for this deal + agent
        const existingRooms = await base44.entities.Room.filter({
            deal_id: deal_id,
            investorId: investorProfile.id,
            agentId: agent_id
        });

        let roomId;
        if (existingRooms.length > 0) {
            roomId = existingRooms[0].id;
        } else {
            const newRoom = await base44.entities.Room.create({
                investorId: investorProfile.id,
                agentId: agent_id,
                deal_id: deal_id,
                ndaAcceptedInvestor: false,
                ndaAcceptedAgent: false
            });
            roomId = newRoom.id;
        }

        return Response.json({ 
            ok: true, 
            room_id: roomId 
        });

    } catch (error) {
        console.error('createDealRoom error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});