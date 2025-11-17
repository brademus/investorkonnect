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

    rooms.forEach(r => {
      const otherId = r.investorId === profile.id ? r.agentId : r.investorId;
      const counterparty = profilesById.get(otherId);
      r.counterparty_name = counterparty?.full_name || counterparty?.email || `User ${otherId?.slice(0, 6)}`;
      r.counterparty_role = r.investorId === profile.id ? 'agent' : 'investor';
    });

    return Response.json({ items: rooms });
  } catch (error) {
    console.error('[listMyRooms] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});