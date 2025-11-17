import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").toLowerCase();

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const myProfile = profiles[0];
    
    if (!myProfile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    const myRole = myProfile.user_role || myProfile.role;
    const targetRole = myRole === "agent" ? "investor" : "agent";

    // Get all profiles with target role
    const allProfiles = await base44.entities.Profile.filter({});
    let items = allProfiles.filter(p => {
      const pRole = p.user_role || p.role;
      return pRole === targetRole;
    });

    // Filter by search query
    if (q) {
      items = items.filter(p =>
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.company || "").toLowerCase().includes(q)
      );
    }

    return Response.json({ items: items.slice(0, 20) });
  } catch (error) {
    console.error('[searchCounterparties] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});