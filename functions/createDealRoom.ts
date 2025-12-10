import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function audit(base44, actor_profile_id, action, entity_type, entity_id, meta = {}) {
  try {
    await base44.entities.AuditLog.create({ 
      actor_profile_id, 
      action, 
      entity_type, 
      entity_id, 
      meta,
      timestamp: new Date().toISOString()
    });
  } catch (e) { 
    console.error("Audit failed:", e); 
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { counterparty_profile_id } = body || {};
    
    if (!counterparty_profile_id) {
      return Response.json({ error: "counterparty_profile_id required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user profile
    const myProfiles = await base44.entities.Profile.filter({ user_id: user.id });
    let myProfile = myProfiles[0];
    
    if (!myProfile) {
      // Auto-create profile if missing (e.g. admin or new user)
      try {
        console.log("Auto-creating profile for user:", user.id);
        myProfile = await base44.entities.Profile.create({
          user_id: user.id,
          email: user.email,
          full_name: user.full_name || user.email.split('@')[0],
          role: user.role || 'member',
          user_role: user.role === 'admin' ? 'admin' : 'investor', // Default to investor if unknown
          onboarding_step: 'auto_created',
          created_date: new Date().toISOString()
        });
      } catch (e) {
        console.error("Failed to auto-create profile:", e);
        return Response.json({ error: "Profile not found and could not be created" }, { status: 404 });
      }
    }

    // Get counterparty profile
    const cpProfiles = await base44.entities.Profile.filter({ id: counterparty_profile_id });
    const cp = cpProfiles[0];
    
    if (!cp) {
      return Response.json({ error: "Counterparty not found" }, { status: 404 });
    }

    let myRole = myProfile.user_role || myProfile.role;
    const cpRole = cp.user_role || cp.role;

    // Handle Admin/Member acting as opposite of counterparty
    if (myRole === 'admin' || myRole === 'member') {
      myRole = cpRole === 'agent' ? 'investor' : 'agent';
    }

    // Roles must be opposite (or compatible)
    if (myRole === cpRole) {
      return Response.json({ error: "Room requires opposite roles (investor↔agent)" }, { status: 400 });
    }

    // Determine investor and agent
    const investorId = myRole === "investor" ? myProfile.id : cp.id;
    const agentId = myRole === "agent" ? myProfile.id : cp.id;

    // Check if room already exists
    const existingRooms = await base44.entities.Room.filter({
      investorId: investorId,
      agentId: agentId
    });

    let room = existingRooms[0];

    if (!room) {
      // Create new room
      const investorName = myRole === "investor" ? (myProfile.full_name || "Investor") : (cp.full_name || "Investor");
      const agentName = myRole === "agent" ? (myProfile.full_name || "Agent") : (cp.full_name || "Agent");
      
      room = await base44.entities.Room.create({
        investorId: investorId,
        agentId: agentId,
        ndaAcceptedInvestor: false,
        ndaAcceptedAgent: false
      });

      // Create participant records
      try {
        await base44.entities.RoomParticipant.create({ 
          room_id: room.id, 
          profile_id: investorId, 
          role: "investor" 
        });
        await base44.entities.RoomParticipant.create({ 
          room_id: room.id, 
          profile_id: agentId, 
          role: "agent" 
        });
      } catch (e) {
        console.log("RoomParticipant creation failed (might not exist yet):", e.message);
      }

      await audit(base44, myProfile.id, "room.create", "Room", room.id, { counterparty_profile_id });
    } else {
      await audit(base44, myProfile.id, "room.reuse", "Room", room.id, { counterparty_profile_id });
    }

    return Response.json({ ok: true, room });
  } catch (error) {
    console.error('[createDealRoom] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});