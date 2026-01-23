import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user's profile
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        if (!profiles.length) {
            return Response.json({ error: 'Profile not found' }, { status: 404 });
        }

        const investorId = profiles[0].id;

        // Get all deals for this investor
        const allDeals = await base44.entities.Deal.filter({ 
            investor_id: investorId 
        });

        // Group by property_address
        const dealsByAddress = new Map();
        
        for (const deal of allDeals) {
            const key = deal.property_address || deal.id; // Use ID as fallback for deals without address
            
            if (!dealsByAddress.has(key)) {
                dealsByAddress.set(key, []);
            }
            dealsByAddress.get(key).push(deal);
        }

        let deduplicatedCount = 0;
        const deletedIds = [];

        // For each address group, keep only the best deal
        for (const [address, deals] of dealsByAddress.entries()) {
            if (deals.length <= 1) continue;

            // Sort: prioritize deals with agents, then by created_date (newest first)
            deals.sort((a, b) => {
                if (a.agent_id && !b.agent_id) return -1;
                if (!a.agent_id && b.agent_id) return 1;
                return new Date(b.created_date) - new Date(a.created_date);
            });

            // Keep the first (best) deal, archive the rest
            const keepDeal = deals[0];
            const duplicates = deals.slice(1);

            for (const dup of duplicates) {
                await base44.asServiceRole.entities.Deal.update(dup.id, {
                    status: 'archived'
                });
                deletedIds.push(dup.id);
                deduplicatedCount++;
            }
        }

        return Response.json({ 
            success: true, 
            deduplicatedCount,
            deletedIds,
            message: `Archived ${deduplicatedCount} duplicate deals`
        });

    } catch (error) {
        console.error('Deduplication error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});