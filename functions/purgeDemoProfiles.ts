import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin-only: Purge ALL example/demo accounts and related data
 *
 * Targets any Profile whose email matches typical demo patterns and removes:
 * - Deals where profile is agent or investor (and their LegalAgreements, schedules, milestones, activities)
 * - Rooms tied to those deals (and their Messages, Participants, Contracts, Activities)
 * - Direct rooms where this profile is agentId/investorId (safety)
 * - Finally, deletes the Profile
 *
 * Demo patterns:
 * - *@investorkonnect.demo (seeded demos)
 * - *.wi{digits}@example.com (legacy WI examples)
 * - *@example.com (generic examples)
 *
 * Usage from frontend/admin tools:
 * await base44.functions.invoke('purgeDemoProfiles', { dryRun: true }); // preview only
 * await base44.functions.invoke('purgeDemoProfiles', { dryRun: false }); // execute deletions
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth + admin guard
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

    const payload = await req.json().catch(() => ({}));
    const dryRun = payload?.dryRun !== false; // default true for safety
    const maxCount = typeof payload?.maxCount === 'number' ? payload.maxCount : 5000;

    const batchLimit = 2000;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Load a broad set of profiles; we filter in code for demo patterns
    const allProfiles = await base44.asServiceRole.entities.Profile.filter({}, undefined, batchLimit);

    const isDemoEmail = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@investorkonnect.demo');
    const isLegacyWiExample = (email) => typeof email === 'string' && /\.wi\d+@example\.com$/i.test(email);
    const isGenericExampleCom = (email) => typeof email === 'string' && email.toLowerCase().endsWith('@example.com');

    const demoProfiles = (allProfiles || []).filter((p) => {
      const email = p?.email || '';
      return isDemoEmail(email) || isLegacyWiExample(email) || isGenericExampleCom(email);
    }).slice(0, maxCount);

    let totalRoomsDeleted = 0;
    let totalDealsDeleted = 0;
    let totalProfilesDeleted = 0;
    let totalMessagesDeleted = 0;
    let totalParticipantsDeleted = 0;
    let totalContractsDeleted = 0;
    let totalActivitiesDeleted = 0;
    let totalAgreementsDeleted = 0;
    let totalSchedulesDeleted = 0;
    let totalMilestonesDeleted = 0;

    const deletedDealIds = new Set();

    console.log('[purgeDemoProfiles] Scanned profiles:', allProfiles?.length || 0, 'Demo matches:', demoProfiles.length, 'dryRun:', dryRun);

    for (const profile of demoProfiles) {
      // Collect deals where this profile is agent or investor
      const agentDeals = await base44.asServiceRole.entities.Deal.filter({ agent_id: profile.id }, undefined, batchLimit);
      const investorDeals = await base44.asServiceRole.entities.Deal.filter({ investor_id: profile.id }, undefined, batchLimit);
      const uniqueDeals = [...(agentDeals || []), ...(investorDeals || [])];

      // For each deal, delete related records then the deal
      for (const d of uniqueDeals) {
        if (!d?.id || deletedDealIds.has(d.id)) continue;

        // Agreements
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: d.id }, undefined, batchLimit);
        for (const a of agreements || []) {
          if (!dryRun) await base44.asServiceRole.entities.LegalAgreement.delete(a.id);
          totalAgreementsDeleted += 1;
          await sleep(10);
        }

        // Payment schedules and milestones
        const schedules = await base44.asServiceRole.entities.PaymentSchedule.filter({ deal_id: d.id }, undefined, batchLimit);
        for (const s of schedules || []) {
          const milestones = await base44.asServiceRole.entities.PaymentMilestone.filter({ schedule_id: s.id }, undefined, batchLimit);
          for (const m of milestones || []) {
            if (!dryRun) await base44.asServiceRole.entities.PaymentMilestone.delete(m.id);
            totalMilestonesDeleted += 1;
            await sleep(5);
          }
          if (!dryRun) await base44.asServiceRole.entities.PaymentSchedule.delete(s.id);
          totalSchedulesDeleted += 1;
          await sleep(10);
        }

        // Activities by deal_id
        const dealActivities = await base44.asServiceRole.entities.Activity.filter({ deal_id: d.id }, undefined, batchLimit);
        for (const act of dealActivities || []) {
          if (!dryRun) await base44.asServiceRole.entities.Activity.delete(act.id);
          totalActivitiesDeleted += 1;
          await sleep(5);
        }

        // Rooms tied to this deal
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: d.id }, undefined, batchLimit);
        for (const r of rooms || []) {
          // Messages
          const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: r.id }, undefined, batchLimit);
          for (const msg of msgs || []) {
            if (!dryRun) await base44.asServiceRole.entities.Message.delete(msg.id);
            totalMessagesDeleted += 1;
          }

          // Participants
          const parts = await base44.asServiceRole.entities.RoomParticipant.filter({ room_id: r.id }, undefined, batchLimit);
          for (const part of parts || []) {
            if (!dryRun) await base44.asServiceRole.entities.RoomParticipant.delete(part.id);
            totalParticipantsDeleted += 1;
          }

          // Contracts
          const contracts = await base44.asServiceRole.entities.Contract.filter({ room_id: r.id }, undefined, batchLimit);
          for (const c of contracts || []) {
            if (!dryRun) await base44.asServiceRole.entities.Contract.delete(c.id);
            totalContractsDeleted += 1;
          }

          // Activities by room_id
          const roomActs = await base44.asServiceRole.entities.Activity.filter({ room_id: r.id }, undefined, batchLimit);
          for (const ra of roomActs || []) {
            if (!dryRun) await base44.asServiceRole.entities.Activity.delete(ra.id);
            totalActivitiesDeleted += 1;
          }

          // Delete the room
          if (!dryRun) await base44.asServiceRole.entities.Room.delete(r.id);
          totalRoomsDeleted += 1;
          await sleep(10);
        }

        // Finally delete the deal
        if (!dryRun) await base44.asServiceRole.entities.Deal.delete(d.id);
        totalDealsDeleted += 1;
        deletedDealIds.add(d.id);
        await sleep(15);
      }

      // Safety: delete any direct rooms where this profile appears
      const directRoomsA = await base44.asServiceRole.entities.Room.filter({ agentId: profile.id }, undefined, batchLimit);
      const directRoomsB = await base44.asServiceRole.entities.Room.filter({ investorId: profile.id }, undefined, batchLimit);
      for (const r of [...(directRoomsA || []), ...(directRoomsB || [])]) {
        // cascade minimal cleanup
        const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: r.id }, undefined, batchLimit);
        for (const m of msgs || []) {
          if (!dryRun) await base44.asServiceRole.entities.Message.delete(m.id);
          totalMessagesDeleted += 1;
        }
        const parts = await base44.asServiceRole.entities.RoomParticipant.filter({ room_id: r.id }, undefined, batchLimit);
        for (const p2 of parts || []) {
          if (!dryRun) await base44.asServiceRole.entities.RoomParticipant.delete(p2.id);
          totalParticipantsDeleted += 1;
        }
        const contracts = await base44.asServiceRole.entities.Contract.filter({ room_id: r.id }, undefined, batchLimit);
        for (const c of contracts || []) {
          if (!dryRun) await base44.asServiceRole.entities.Contract.delete(c.id);
          totalContractsDeleted += 1;
        }
        const roomActs = await base44.asServiceRole.entities.Activity.filter({ room_id: r.id }, undefined, batchLimit);
        for (const ra of roomActs || []) {
          if (!dryRun) await base44.asServiceRole.entities.Activity.delete(ra.id);
          totalActivitiesDeleted += 1;
        }
        if (!dryRun) await base44.asServiceRole.entities.Room.delete(r.id);
        totalRoomsDeleted += 1;
        await sleep(10);
      }

      // Delete the profile itself
      if (!dryRun) await base44.asServiceRole.entities.Profile.delete(profile.id);
      totalProfilesDeleted += 1;
      await sleep(20);
    }

    return Response.json({
      success: true,
      dryRun,
      scanned_profiles: allProfiles?.length || 0,
      demo_profiles_matched: demoProfiles.length,
      deleted: {
        profiles: totalProfilesDeleted,
        deals: totalDealsDeleted,
        rooms: totalRoomsDeleted,
        messages: totalMessagesDeleted,
        participants: totalParticipantsDeleted,
        contracts: totalContractsDeleted,
        activities: totalActivitiesDeleted,
        agreements: totalAgreementsDeleted,
        payment_schedules: totalSchedulesDeleted,
        payment_milestones: totalMilestonesDeleted,
      },
    });
  } catch (error) {
    console.error('[purgeDemoProfiles] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});