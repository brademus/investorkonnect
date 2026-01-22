import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function safeList(fn, ...args) {
  try { return await fn(...args); } catch { return []; }
}

async function deleteAll(base44, entityName, records) {
  for (const r of records) {
    try { await base44.asServiceRole.entities[entityName].delete(r.id); } catch (_) {}
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me || me.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const emails = Array.isArray(body?.emails) ? body.emails : [];
    if (emails.length === 0) {
      return Response.json({ error: 'Provide emails: string[] as { emails: [..] }' }, { status: 400 });
    }

    const summary = [];

    for (const rawEmail of emails) {
      const email = String(rawEmail || '').toLowerCase().trim();
      if (!email) continue;

      // Find Profiles by email
      const profiles = await safeList(base44.asServiceRole.entities.Profile.filter, { email });
      const profileIds = profiles.map(p => p.id);

      // Gather deals linked to each profile as investor or agent
      const deals = [];
      for (const pid of profileIds) {
        const d1 = await safeList(base44.asServiceRole.entities.Deal.filter, { investor_id: pid });
        const d2 = await safeList(base44.asServiceRole.entities.Deal.filter, { agent_id: pid });
        deals.push(...d1, ...d2);
      }

      // Dedupe deals by id
      const dealMap = new Map();
      for (const d of deals) if (d?.id && !dealMap.has(d.id)) dealMap.set(d.id, d);
      const uniqueDeals = Array.from(dealMap.values());

      let deletedCounts = {
        deals: 0,
        rooms: 0,
        roomMessages: 0,
        messages: 0,
        roomParticipants: 0,
        contracts: 0,
        activities: 0,
        schedules: 0,
        milestones: 0,
        agreements: 0,
        appointments: 0,
        profiles: 0,
        users: 0,
      };

      // Delete per-deal related entities first, then the deal
      for (const deal of uniqueDeals) {
        const dealId = deal.id;

        // Rooms for this deal
        const rooms = await safeList(base44.asServiceRole.entities.Room.filter, { deal_id: dealId });
        const roomIds = rooms.map(r => r.id);

        // Room sub-entities
        for (const roomId of roomIds) {
          const roomMsgs = await safeList(base44.asServiceRole.entities.RoomMessage.filter, { roomId });
          await deleteAll(base44, 'RoomMessage', roomMsgs);
          deletedCounts.roomMessages += roomMsgs.length;

          const msgs = await safeList(base44.asServiceRole.entities.Message.filter, { room_id: roomId });
          await deleteAll(base44, 'Message', msgs);
          deletedCounts.messages += msgs.length;

          const parts = await safeList(base44.asServiceRole.entities.RoomParticipant.filter, { room_id: roomId });
          await deleteAll(base44, 'RoomParticipant', parts);
          deletedCounts.roomParticipants += parts.length;

          const contracts = await safeList(base44.asServiceRole.entities.Contract.filter, { room_id: roomId });
          await deleteAll(base44, 'Contract', contracts);
          deletedCounts.contracts += contracts.length;
        }

        // Activities for this deal
        const activities = await safeList(base44.asServiceRole.entities.Activity.filter, { deal_id: dealId });
        await deleteAll(base44, 'Activity', activities);
        deletedCounts.activities += activities.length;

        // Payment schedules + milestones
        const schedules = await safeList(base44.asServiceRole.entities.PaymentSchedule.filter, { deal_id: dealId });
        for (const sch of schedules) {
          const milestonesBySchedule = await safeList(base44.asServiceRole.entities.PaymentMilestone.filter, { schedule_id: sch.id });
          await deleteAll(base44, 'PaymentMilestone', milestonesBySchedule);
          deletedCounts.milestones += milestonesBySchedule.length;
        }
        await deleteAll(base44, 'PaymentSchedule', schedules);
        deletedCounts.schedules += schedules.length;

        // Milestones by deal_id (extra safety)
        const milestonesByDeal = await safeList(base44.asServiceRole.entities.PaymentMilestone.filter, { deal_id: dealId });
        await deleteAll(base44, 'PaymentMilestone', milestonesByDeal);
        deletedCounts.milestones += milestonesByDeal.length;

        // Legal agreements
        const agreements = await safeList(base44.asServiceRole.entities.LegalAgreement.filter, { deal_id: dealId });
        await deleteAll(base44, 'LegalAgreement', agreements);
        deletedCounts.agreements += agreements.length;

        // Deal appointments (entity uses dealId camelCase in app code)
        const appts = await safeList(base44.asServiceRole.entities.DealAppointments?.filter || (() => []), { dealId: dealId });
        if (appts?.length) {
          await deleteAll(base44, 'DealAppointments', appts);
          deletedCounts.appointments += appts.length;
        }

        // Delete rooms
        await deleteAll(base44, 'Room', rooms);
        deletedCounts.rooms += rooms.length;

        // Finally, delete the deal
        try { await base44.asServiceRole.entities.Deal.delete(dealId); deletedCounts.deals += 1; } catch (_) {}
      }

      // Delete profiles
      await deleteAll(base44, 'Profile', profiles);
      deletedCounts.profiles += profiles.length;

      // Delete users by email (built-in User entity)
      const users = await safeList(base44.asServiceRole.entities.User.filter, { email });
      await deleteAll(base44, 'User', users);
      deletedCounts.users += users.length;

      summary.push({ email, profileIds, deleted: deletedCounts, dealIds: uniqueDeals.map(d => d.id) });
    }

    return Response.json({ success: true, summary });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});