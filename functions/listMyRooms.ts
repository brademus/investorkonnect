import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get Profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    // 2. Fetch Rooms (Parallel)
    const [investorRooms, agentRooms] = await Promise.all([
      base44.entities.Room.filter({ investorId: profile.id }).catch(e => []),
      base44.entities.Room.filter({ agentId: profile.id }).catch(e => [])
    ]);

    // Dedup rooms by ID
    const roomsMap = new Map();
    [...investorRooms, ...agentRooms].forEach(r => roomsMap.set(r.id, r));
    const rooms = Array.from(roomsMap.values());

    // 3. Fetch Counterparties (Parallel)
    const otherIds = new Set();
    rooms.forEach(r => {
      const otherId = r.investorId === profile.id ? r.agentId : r.investorId;
      if (otherId) otherIds.add(otherId);
    });

    const otherProfilesMap = new Map();
    if (otherIds.size > 0) {
      const pList = await base44.entities.Profile.filter({ id: { $in: Array.from(otherIds) } });
      pList.forEach(p => otherProfilesMap.set(p.id, p));
    }

    // 4. Fetch Deals
    // We need: 
    // a) Deals referenced by rooms (r.deal_id)
    // b) Active deals owned by this user (for inference)
    
    const roomDealIds = new Set(rooms.map(r => r.deal_id).filter(Boolean));
    const dealsMap = new Map();

    // Fetch user's own deals
    let myActiveDeals = [];
    try {
      // Get all deals for this investor to support inference and orphans
      const myDeals = await base44.entities.Deal.filter({ investor_id: profile.id });
      myDeals.forEach(d => {
        dealsMap.set(d.id, d);
        // Track active ones for inference
        if (d.status !== 'archived' && d.status !== 'closed') {
          myActiveDeals.push(d);
        }
      });
    } catch (e) {
      console.error("Error fetching my deals:", e);
    }

    // Sort active deals by date (newest first) for inference priority
    myActiveDeals.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

    // Fetch any missing deals referenced by rooms
    const missingDealIds = Array.from(roomDealIds).filter(id => !dealsMap.has(id));
    if (missingDealIds.length > 0) {
      try {
        const extraDeals = await base44.entities.Deal.filter({ id: { $in: missingDealIds } });
        extraDeals.forEach(d => dealsMap.set(d.id, d));
      } catch (e) {
        console.error("Error fetching extra deals:", e);
      }
    }

    // 5. Construct Final List
    const finalRooms = [];
    const usedDealIds = new Set(); // Track which deals are attached to rooms

    rooms.forEach(r => {
      // Determine Counterparty
      const otherId = r.investorId === profile.id ? r.agentId : r.investorId;
      if (!otherId) return; // Skip invalid rooms

      const counterparty = otherProfilesMap.get(otherId);
      if (!counterparty) return; // Skip if profile missing

      // Basic Room Info
      r.counterparty_name = counterparty.full_name || counterparty.email || "Unknown User";
      r.counterparty_role = r.investorId === profile.id ? 'agent' : 'investor';
      r.counterparty_image = counterparty.headshotUrl || null; // Add image if available

      // Deal Logic
      let deal = null;

      if (r.deal_id) {
        // Explicit link
        deal = dealsMap.get(r.deal_id);
      } else if (r.investorId === profile.id) {
        // Inference: If I am investor and room has no deal, infer the most recent active deal
        if (myActiveDeals.length > 0) {
          deal = myActiveDeals[0];
          // We don't verify agent match here, assuming open deals can be discussed with anyone
        }
      }

      if (deal) {
        r.deal_title = deal.title; // Explicit field for deal title
        r.title = deal.title; // Legacy support
        r.property_address = deal.property_address;
        r.city = deal.city;
        r.state = deal.state;
        r.budget = deal.purchase_price;
        r.pipeline_stage = deal.pipeline_stage;
        r.contract_date = deal.key_dates?.closing_date;
        
        // Helper flags
        if (!r.deal_id) r.suggested_deal_id = deal.id;
        r.deal_assigned_agent_id = deal.agent_id;
        
        usedDealIds.add(deal.id);
      }

      finalRooms.push(r);
    });

    // 6. Add Orphan Deals (Deals I own that aren't linked to a room yet)
    // Only if they aren't already used in a valid room
    myActiveDeals.forEach(deal => {
      if (!usedDealIds.has(deal.id)) {
        finalRooms.push({
          id: `virtual_${deal.id}`,
          deal_id: deal.id,
          title: deal.title,
          property_address: deal.property_address,
          city: deal.city,
          state: deal.state,
          budget: deal.purchase_price,
          pipeline_stage: deal.pipeline_stage || 'new_deal_under_contract',
          created_date: deal.created_date,
          counterparty_name: 'No Agent Selected',
          counterparty_role: 'none',
          is_orphan: true
        });
      }
    });

    // Sort by most recent activity/creation
    finalRooms.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));

    // Dedup by Counterparty ID (keep most recent)
    // We allow multiple "Orphans" (No Agent Selected) but only one chat per distinct person
    const uniqueRooms = [];
    const seenCounterparties = new Set();

    for (const r of finalRooms) {
      // If it's an orphan or has no distinct counterparty (unlikely for real rooms), keep it
      // actually orphans have counterparty_role='none'
      if (r.is_orphan || !r.counterparty_role || r.counterparty_role === 'none') {
        uniqueRooms.push(r);
        continue;
      }

      // Identify counterparty by ID (we need to find the ID)
      // We didn't explicitly store counterparty_id in the final object in step 5, let's fix that or use name as fallback (risky)
      // Let's rely on the logic in step 5 where we found the counterparty.
      const otherId = r.investorId === profile.id ? r.agentId : r.investorId;
      
      if (otherId) {
        if (seenCounterparties.has(otherId)) {
          continue; // Skip duplicate (older because we sorted by date desc)
        }
        seenCounterparties.add(otherId);
      }
      
      uniqueRooms.push(r);
    }

    return Response.json({ items: uniqueRooms });
  } catch (error) {
    console.error('[listMyRooms] Critical Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});