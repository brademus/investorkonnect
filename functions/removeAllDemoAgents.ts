import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Require auth
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only guard
    const myProfiles = await base44.entities.Profile.filter({ user_id: user.id });
    const myProfile = myProfiles?.[0] || null;
    const isAdmin = user.role === 'admin' || myProfile?.role === 'admin' || myProfile?.user_role === 'admin';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const batchLimit = 2000;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Fetch all agent profiles; filter in-code for demo domain
    const agents = await base44.asServiceRole.entities.Profile.filter({ user_role: 'agent' }, undefined, batchLimit);
    const isDemoEmail = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@investorkonnect.demo');
    const isDemoExample = (email) => typeof email === 'string' && /\.wi\d+@example\.com$/i.test(email); // legacy WI demo pattern

    const demoAgents = (agents || []).filter((p) => isDemoEmail(p?.email) || isDemoExample(p?.email));

    let roomsDeleted = 0;
    let dealsDeleted = 0;
    let profilesDeleted = 0;

    const deletedDealIds = new Set();

    for (const p of demoAgents) {
      // Delete ACTIVE deals where this demo agent is assigned or (edge) appears as investor
      const agentDeals = await base44.asServiceRole.entities.Deal.filter({ agent_id: p.id, status: 'active' }, undefined, batchLimit);
      const investorDeals = await base44.asServiceRole.entities.Deal.filter({ investor_id: p.id, status: 'active' }, undefined, batchLimit);

      const uniqueDeals = [...(agentDeals || []), ...(investorDeals || [])];

      for (const d of uniqueDeals) {
        if (deletedDealIds.has(d.id)) continue;
        // Delete rooms tied to this deal
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: d.id }, undefined, batchLimit);
        for (const r of rooms || []) {
          try {
            await base44.asServiceRole.entities.Room.delete(r.id);
            roomsDeleted += 1;
            await sleep(80);
          } catch (err) {
            console.error('[removeAllDemoAgents] Failed to delete room', r.id, err?.message);
          }
        }
        // Delete the deal itself
        try {
          await base44.asServiceRole.entities.Deal.delete(d.id);
          dealsDeleted += 1;
          deletedDealIds.add(d.id);
          await sleep(120);
        } catch (err) {
          console.error('[removeAllDemoAgents] Failed to delete deal', d.id, err?.message);
        }
      }

      // Finally delete the demo agent profile
      try {
        await base44.asServiceRole.entities.Profile.delete(p.id);
        profilesDeleted += 1;
      } catch (err) {
        console.error('[removeAllDemoAgents] Failed to delete profile', p.id, p.email, err?.message);
      }
    }

    return Response.json({
      success: true,
      scanned_agents: agents?.length || 0,
      demo_agents_found: demoAgents.length,
      deleted: {
        profiles: profilesDeleted,
        deals_active: dealsDeleted,
        rooms: roomsDeleted,
      },
    });
  } catch (error) {
    console.error('[removeAllDemoAgents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});