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
    if (me?.role !== 'admin') {
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
        reviews: 0,
        matches: 0,
        introRequests: 0,
        profileVectors: 0,
        ndas: 0,
        auditLogs: 0,
        extraRooms: 0,
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
        const roomsAgain = await safeList(base44.asServiceRole.entities.Room.filter, { deal_id: dealId });
        await deleteAll(base44, 'Room', roomsAgain);
        deletedCounts.rooms += roomsAgain.length;

        // Finally, delete the deal
        try { await base44.asServiceRole.entities.Deal.delete(dealId); deletedCounts.deals += 1; } catch (_) {}
      }

      // Extra cleanup: rooms tied directly to profiles (investorId/agentId), in case any exist without deal_id
      const roomsByProfiles = [];
      for (const pid of profileIds) {
        const r1 = await safeList(base44.asServiceRole.entities.Room.filter, { investorId: pid });
        const r2 = await safeList(base44.asServiceRole.entities.Room.filter, { agentId: pid });
        roomsByProfiles.push(...r1, ...r2);
      }
      // Dedupe by id
      const extraRoomMap = new Map();
      for (const r of roomsByProfiles) if (r?.id && !extraRoomMap.has(r.id)) extraRoomMap.set(r.id, r);
      const extraRooms = Array.from(extraRoomMap.values());

      for (const room of extraRooms) {
        const roomId = room.id;
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
      if (extraRooms.length) {
        await deleteAll(base44, 'Room', extraRooms);
        deletedCounts.extraRooms += extraRooms.length;
      }

      // Delete Reviews where this profile is reviewer or reviewee
      for (const pid of profileIds) {
        const rcv = await safeList(base44.asServiceRole.entities.Review.filter, { reviewee_profile_id: pid });
        await deleteAll(base44, 'Review', rcv);
        deletedCounts.reviews += rcv.length;
        const rvr = await safeList(base44.asServiceRole.entities.Review.filter, { reviewer_profile_id: pid });
        await deleteAll(base44, 'Review', rvr);
        deletedCounts.reviews += rvr.length;
      }

      // Delete Matches and IntroRequests involving these profiles
      for (const pid of profileIds) {
        const matchesAsInvestor = await safeList(base44.asServiceRole.entities.Match.filter, { investorId: pid });
        const matchesAsAgent = await safeList(base44.asServiceRole.entities.Match.filter, { agentId: pid });
        await deleteAll(base44, 'Match', matchesAsInvestor);
        await deleteAll(base44, 'Match', matchesAsAgent);
        deletedCounts.matches += matchesAsInvestor.length + matchesAsAgent.length;

        const introsAsInvestor = await safeList(base44.asServiceRole.entities.IntroRequest.filter, { investorId: pid });
        const introsAsAgent = await safeList(base44.asServiceRole.entities.IntroRequest.filter, { agentId: pid });
        await deleteAll(base44, 'IntroRequest', introsAsInvestor);
        await deleteAll(base44, 'IntroRequest', introsAsAgent);
        deletedCounts.introRequests += introsAsInvestor.length + introsAsAgent.length;
      }

      // Delete ProfileVector embeddings
      for (const pid of profileIds) {
        const vectors = await safeList(base44.asServiceRole.entities.ProfileVector.filter, { profile_id: pid });
        await deleteAll(base44, 'ProfileVector', vectors);
        deletedCounts.profileVectors += vectors.length;
      }

      // Delete NDA records by profile id or email
      const ndasByPid = [];
      for (const pid of profileIds) {
        const n = await safeList(base44.asServiceRole.entities.NDA.filter, { user_id: pid });
        ndasByPid.push(...n);
      }
      const ndasByEmail = await safeList(base44.asServiceRole.entities.NDA.filter, { user_email: email });
      const ndaMap = new Map();
      for (const n of [...ndasByPid, ...ndasByEmail]) if (n?.id && !ndaMap.has(n.id)) ndaMap.set(n.id, n);
      const ndas = Array.from(ndaMap.values());
      if (ndas.length) {
        await deleteAll(base44, 'NDA', ndas);
        deletedCounts.ndas += ndas.length;
      }

      // Delete AuditLogs by actor_id and entity_id references
      for (const pid of profileIds) {
        const alByActor = await safeList(base44.asServiceRole.entities.AuditLog.filter, { actor_id: pid });
        await deleteAll(base44, 'AuditLog', alByActor);
        deletedCounts.auditLogs += alByActor.length;
      }
      // By deals and rooms entity references
      const dealIds = uniqueDeals.map(d => d.id);
      if (dealIds.length) {
        for (const did of dealIds) {
          const alByDeal = await safeList(base44.asServiceRole.entities.AuditLog.filter, { entity_id: did });
          await deleteAll(base44, 'AuditLog', alByDeal);
          deletedCounts.auditLogs += alByDeal.length;
        }
      }
      const allRoomIds = [];
      for (const d of uniqueDeals) {
        const rs = await safeList(base44.asServiceRole.entities.Room.filter, { deal_id: d.id });
        for (const r of rs) allRoomIds.push(r.id);
      }
      for (const rId of allRoomIds) {
        const alByRoom = await safeList(base44.asServiceRole.entities.AuditLog.filter, { entity_id: rId });
        await deleteAll(base44, 'AuditLog', alByRoom);
        deletedCounts.auditLogs += alByRoom.length;
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