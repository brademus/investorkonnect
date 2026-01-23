import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin-only: Purge example/demo agent profiles and their related data
 *
 * What it does:
 * - Finds agent profiles with demo/example emails
 * - Deletes related Rooms (where agentId matches; also checks investorId as safety)
 * - Deletes related Deals (where agent_id or investor_id matches)
 * - Deletes the agent Profile
 *
 * Demo detection patterns:
 * - Emails ending with @investorkonnect.demo (seeded demos)
 * - Legacy WI demo pattern: *.wi\d+@example.com
 * - Generic example.com agents: any @example.com address
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth + Admin guard
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const myProfiles = await base44.entities.Profile.filter({ user_id: user.id });
    const myProfile = myProfiles?.[0] || null;
    const isAdmin = user.role === 'admin' || myProfile?.role === 'admin' || myProfile?.user_role === 'admin';
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { maxCount = 2000, dryRun = false } = await req.json().catch(() => ({ }));

    const batchLimit = 2000;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Load candidate agent profiles
    const agents = await base44.asServiceRole.entities.Profile.filter({ user_role: 'agent' }, undefined, batchLimit);

    const isDemoEmail = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@investorkonnect.demo');
    const isLegacyWiExample = (email) => typeof email === 'string' && /\.wi\d+@example\.com$/i.test(email);
    const isGenericExampleCom = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@example.com');

    const demoAgents = (agents || []).filter((p) => {
      const email = p?.email || '';
      return isDemoEmail(email) || isLegacyWiExample(email) || isGenericExampleCom(email);
    });

    const targets = demoAgents.slice(0, maxCount);

    let roomsDeleted = 0;
    let dealsDeleted = 0;
    let profilesDeleted = 0;

    const deletedDealIds = new Set();

    console.log('[purgeExampleAgents] Candidates:', agents?.length || 0, 'Demo targets:', targets.length);

    for (const p of targets) {
      // Collect deals for this profile (as agent or investor)
      const agentDeals = await base44.asServiceRole.entities.Deal.filter({ agent_id: p.id }, undefined, batchLimit);
      const investorDeals = await base44.asServiceRole.entities.Deal.filter({ investor_id: p.id }, undefined, batchLimit);
      const uniqueDeals = [...(agentDeals || []), ...(investorDeals || [])];

      // For each deal: delete rooms, then delete deal
      for (const d of uniqueDeals) {
        if (deletedDealIds.has(d.id)) continue;

        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: d.id }, undefined, batchLimit);
        for (const r of rooms || []) {
          if (!dryRun) {
            try {
              await base44.asServiceRole.entities.Room.delete(r.id);
              roomsDeleted += 1;
              await sleep(50);
            } catch (err) {
              console.error('[purgeExampleAgents] Failed to delete room', r.id, err?.message);
            }
          }
        }

        if (!dryRun) {
          try {
            await base44.asServiceRole.entities.Deal.delete(d.id);
            dealsDeleted += 1;
            deletedDealIds.add(d.id);
            await sleep(80);
          } catch (err) {
            console.error('[purgeExampleAgents] Failed to delete deal', d.id, err?.message);
          }
        }
      }

      // Also delete stray rooms where this profile is directly attached (safety)
      const directRooms = await base44.asServiceRole.entities.Room.filter({ agentId: p.id }, undefined, batchLimit);
      const directRoomsAsInvestor = await base44.asServiceRole.entities.Room.filter({ investorId: p.id }, undefined, batchLimit);
      for (const r of [...(directRooms || []), ...(directRoomsAsInvestor || [])]) {
        if (!dryRun) {
          try {
            await base44.asServiceRole.entities.Room.delete(r.id);
            roomsDeleted += 1;
            await sleep(40);
          } catch (err) {
            console.error('[purgeExampleAgents] Failed to delete direct room', r.id, err?.message);
          }
        }
      }

      // Finally delete the profile
      if (!dryRun) {
        try {
          await base44.asServiceRole.entities.Profile.delete(p.id);
          profilesDeleted += 1;
          await sleep(80);
        } catch (err) {
          console.error('[purgeExampleAgents] Failed to delete profile', p.id, p.email, err?.message);
        }
      }
    }

    return Response.json({
      success: true,
      dryRun,
      scanned_agents: agents?.length || 0,
      demo_agents_found: demoAgents.length,
      processed_this_run: targets.length,
      deleted: {
        profiles: profilesDeleted,
        deals: dealsDeleted,
        rooms: roomsDeleted,
      },
    });
  } catch (error) {
    console.error('[purgeExampleAgents] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});