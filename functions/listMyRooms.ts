import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const roomsMap = new Map();

    // Get rooms where user is investor
    try {
      const investorRooms = await base44.entities.Room.filter({ investorId: profile.id });
      investorRooms.forEach(r => roomsMap.set(r.id, r));
    } catch (e) {
      console.log("Error fetching investor rooms:", e.message);
    }

    // Get rooms where user is agent
    try {
      const agentRooms = await base44.entities.Room.filter({ agentId: profile.id });
      agentRooms.forEach(r => roomsMap.set(r.id, r));
    } catch (e) {
      console.log("Error fetching agent rooms:", e.message);
    }

    const rooms = Array.from(roomsMap.values());

    // Enrich with counterparty names
    const otherIds = [];
    rooms.forEach(r => {
      const otherId = r.investorId === profile.id ? r.agentId : r.investorId;
      if (otherId) otherIds.push(otherId);
    });

    const uniqueIds = Array.from(new Set(otherIds));
    const otherProfiles = await base44.entities.Profile.filter({ 
      id: { $in: uniqueIds } 
    });

    const profilesById = new Map();
    otherProfiles.forEach(p => profilesById.set(p.id, p));

    // Enrich with Deal data
    const dealIds = rooms.map(r => r.deal_id).filter(Boolean);
    const dealsById = new Map();
    let myDeals = [];

    // Fetch my deals (for orphans AND inference)
    try {
      myDeals = await base44.entities.Deal.filter({ investor_id: profile.id });
      myDeals.forEach(d => dealsById.set(d.id, d));
    } catch (e) {
      console.log("Error fetching my deals:", e.message);
    }
    
    // Fetch other deals linked to rooms
    const missingDealIds = dealIds.filter(id => !dealsById.has(id));
    if (missingDealIds.length > 0) {
      try {
        const deals = await base44.entities.Deal.filter({ id: { $in: missingDealIds } });
        deals.forEach(d => dealsById.set(d.id, d));
      } catch (e) {
        console.log("Error fetching deals:", e.message);
      }
    }

    // Filter out rooms with missing counterparties (broken/test rooms)
    const validRooms = [];
    rooms.forEach(r => {
      const otherId = r.investorId === profile.id ? r.agentId : r.investorId;
      // If no valid counterparty ID, skip this room (it's broken)
      if (!otherId) return;

      const counterparty = profilesById.get(otherId);
      // If counterparty profile doesn't exist, skip this room
      if (!counterparty) return;

      r.counterparty_name = counterparty.full_name || counterparty.email || `User ${otherId.slice(0, 6)}`;
      r.counterparty_role = r.investorId === profile.id ? 'agent' : 'investor';
      
      let deal = null;
      if (r.deal_id) {
        deal = dealsById.get(r.deal_id);
      } else if (r.investorId === profile.id) {
        // Infer deal if I'm the investor and have active deals
        const activeDeals = myDeals.filter(d => d.status !== 'archived' && d.status !== 'closed');
        if (activeDeals.length > 0) {
          // Use most recent active deal
          activeDeals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          deal = activeDeals[0];
        }
      }

      if (deal) {
        r.pipeline_stage = deal.pipeline_stage;
        r.title = deal.title;
        r.property_address = deal.property_address;
        r.city = deal.city;
        r.state = deal.state;
        r.budget = deal.purchase_price;
        r.contract_date = deal.key_dates?.closing_date;
        
        // Pass the inferred deal ID so frontend can offer to "lock it in"
        if (!r.deal_id) {
          r.suggested_deal_id = deal.id;
        }
        
        // Pass the currently assigned agent ID (if any) to control "Lock In" button
        r.deal_assigned_agent_id = deal.agent_id;
      }

      // If r.deal_id exists but deal not found, we still return the room (as a normal chat),
      // just without the deal info populated above.
      
      validRooms.push(r);
    });

    const finalRooms = validRooms;

    // Find orphan deals (deals created by me but not yet in a room)
    try {
      // myDeals is already fetched above
      
      // Filter out deals that are already in VALID rooms
      // Note: dealIds was calculated from ALL rooms (including invalid ones). 
      // We should recalculate dealIds based on finalRooms to be precise, 
      // BUT if we exclude broken rooms here, their deals will become orphans. 
      // If the user wants 0 deals, converting broken rooms to orphans might show them as "Pending".
      // This is probably better than showing them as "Active".
      const validDealIds = new Set(finalRooms.map(r => r.deal_id).filter(Boolean));
      
      const orphanDeals = myDeals.filter(d => !validDealIds.has(d.id) && d.status !== 'archived');
      
      // Convert orphan deals to room-like objects
      orphanDeals.forEach(deal => {
        finalRooms.push({
          id: `virtual_${deal.id}`, // Virtual ID
          deal_id: deal.id,
          title: deal.title,
          property_address: deal.property_address,
          city: deal.city,
          state: deal.state,
          budget: deal.purchase_price,
          pipeline_stage: deal.pipeline_stage || 'new_deal_under_contract',
          created_date: deal.created_date,
          updated_date: deal.updated_date || deal.created_date,
          contract_date: deal.key_dates?.closing_date,
          counterparty_name: 'No Agent Selected',
          counterparty_role: 'none',
          is_orphan: true // Flag for frontend
        });
      });
    } catch (e) {
      console.log("Error fetching orphan deals:", e.message);
    }

    // Sort combined list by created_date descending (newest first)
    finalRooms.sort((a, b) => {
      const dateA = new Date(a.created_date || 0);
      const dateB = new Date(b.created_date || 0);
      return dateB - dateA;
    });

    return Response.json({ items: finalRooms });
  } catch (error) {
    console.error('[listMyRooms] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});