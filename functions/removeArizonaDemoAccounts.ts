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

    // Find demo profiles we previously seeded in Arizona
    const azCandidates = await base44.asServiceRole.entities.Profile.filter({ target_state: 'AZ' }, undefined, batchLimit);
    const isDemoEmail = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@investorkonnect.demo');

    const demoProfiles = (azCandidates || []).filter((p) => isDemoEmail(p?.email));

    let roomsDeleted = 0;
    let dealsDeleted = 0;
    let profilesDeleted = 0;

    const deletedDealIds = new Set();

    for (const p of demoProfiles) {
      // Delete ACTIVE deals where this profile is agent or investor
      const agentDeals = await base44.asServiceRole.entities.Deal.filter({ agent_id: p.id, status: 'active' }, undefined, batchLimit);
      const investorDeals = await base44.asServiceRole.entities.Deal.filter({ investor_id: p.id, status: 'active' }, undefined, batchLimit);

      const uniqueDeals = [...(agentDeals || []), ...(investorDeals || [])];

      for (const d of uniqueDeals) {
        if (deletedDealIds.has(d.id)) continue;
        // Remove rooms tied to this deal
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: d.id }, undefined, batchLimit);
        for (const r of rooms || []) {
          try {
            await base44.asServiceRole.entities.Room.delete(r.id);
            roomsDeleted += 1;
          } catch (err) {
            console.error('[removeArizonaDemoAccounts] Failed to delete room', r.id, err?.message);
          }
        }
        // Remove the deal
        try {
          await base44.asServiceRole.entities.Deal.delete(d.id);
          dealsDeleted += 1;
          deletedDealIds.add(d.id);
        } catch (err) {
          console.error('[removeArizonaDemoAccounts] Failed to delete deal', d.id, err?.message);
        }
      }

      // Finally, delete the demo profile
      try {
        await base44.asServiceRole.entities.Profile.delete(p.id);
        profilesDeleted += 1;
      } catch (err) {
        console.error('[removeArizonaDemoAccounts] Failed to delete profile', p.id, p.email, err?.message);
      }
    }

    return Response.json({
      success: true,
      scanned_profiles: azCandidates?.length || 0,
      demo_profiles_found: demoProfiles.length,
      deleted: {
        profiles: profilesDeleted,
        deals_active: dealsDeleted,
        rooms: roomsDeleted,
      },
    });
  } catch (error) {
    console.error('[removeArizonaDemoAccounts] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});