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
    
    if (dealIds.length > 0) {
      try {
        const deals = await base44.entities.Deal.filter({ id: { $in: dealIds } });
        deals.forEach(d => dealsById.set(d.id, d));
      } catch (e) {
        console.log("Error fetching deals:", e.message);
      }
    }

    rooms.forEach(r => {
      const otherId = r.investorId === profile.id ? r.agentId : r.investorId;
      const counterparty = profilesById.get(otherId);
      r.counterparty_name = counterparty?.full_name || counterparty?.email || `User ${otherId?.slice(0, 6)}`;
      r.counterparty_role = r.investorId === profile.id ? 'agent' : 'investor';
      
      if (r.deal_id) {
        const deal = dealsById.get(r.deal_id);
        if (deal) {
          r.pipeline_stage = deal.pipeline_stage;
          r.title = deal.title;
          r.property_address = deal.property_address;
          r.city = deal.city;
          r.state = deal.state;
          r.budget = deal.purchase_price;
          r.contract_date = deal.key_dates?.closing_date;
        }
      }
    });

    // Find orphan deals (deals created by me but not yet in a room)
    try {
      // Get all deals where I am the investor, sorted by newest first, limit 100 to catch recent ones
      const myDeals = await base44.entities.Deal.filter(
        { investor_id: profile.id },
        { created_date: -1 },
        100
      );
      
      // Filter out deals that are already in rooms
      const roomDealIds = new Set(dealIds);
      const orphanDeals = myDeals.filter(d => !roomDealIds.has(d.id) && d.status !== 'archived');
      
      // Convert orphan deals to room-like objects
      orphanDeals.forEach(deal => {
        rooms.push({
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
    rooms.sort((a, b) => {
      const dateA = new Date(a.created_date || 0);
      const dateB = new Date(b.created_date || 0);
      return dateB - dateA;
    });

    return Response.json({ items: rooms });
  } catch (error) {
    console.error('[listMyRooms] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});