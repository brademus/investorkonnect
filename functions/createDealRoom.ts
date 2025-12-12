import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const { deal_id, agent_id, counterparty_profile_id } = body;
        
        // Accept both agent_id and counterparty_profile_id for backward compatibility
        const agentProfileId = agent_id || counterparty_profile_id;

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

        if (!agentProfileId) {
            return Response.json({ error: 'Agent ID required' }, { status: 400 });
        }

        // Check if room already exists for this deal + agent
        const existingRooms = await base44.entities.Room.filter({
            deal_id: deal_id,
            investorId: investorProfile.id,
            agentId: agentProfileId
        });

        let room;
        if (existingRooms.length > 0) {
            room = existingRooms[0];
        } else {
            room = await base44.entities.Room.create({
                investorId: investorProfile.id,
                agentId: agentProfileId,
                deal_id: deal_id,
                ndaAcceptedInvestor: false,
                ndaAcceptedAgent: false
            });
        }

        return Response.json({ 
            ok: true, 
            room: {
                id: room.id,
                ...room
            }
        });

    } catch (error) {
        console.error('createDealRoom error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});