import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Admin-only: Reset specific users/profiles and all associated records by email
// Invoke from frontend/admin tools:
//   await base44.functions.invoke('resetProfilesByEmail', { emails: ['a@b.com', 'c@d.com'] })
// Returns a summary report per email
Deno.serve(async (req) => {
  const startedAt = new Date().toISOString();
  const summary = { startedAt, emails: [], results: [], errors: [] };

  try {
    const base44 = createClientFromRequest(req);

    // AuthN + Admin gate
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin via User.role or Profile.role
    let isAdmin = user.role === 'admin';
    if (!isAdmin) {
      try {
        const profs = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
        isAdmin = !!profs?.[0]?.role && profs[0].role === 'admin';
      } catch (_) {}
    }
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse payload
    let payload = {};
    try { payload = await req.json(); } catch (_) {}
    const emails = Array.isArray(payload?.emails) ? payload.emails : [];
    summary.emails = emails;

    if (!emails.length) {
      return Response.json({ error: 'No emails provided', ...summary }, { status: 400 });
    }

    // Helpers
    const norm = (e) => (e || '').toLowerCase().trim();

    async function fetchAll(asSR, entity, filter) {
      try { const rows = await asSR.entities[entity].filter(filter); return Array.isArray(rows) ? rows : []; } catch { return []; }
    }

    async function deleteArray(asSR, entity, items, key = 'id') {
      let count = 0; const errs = [];
      for (const it of items) {
        try { await asSR.entities[entity].delete(it[key]); count++; } catch (e) { errs.push(`${entity}:${it[key]}:${e?.message || e}`); }
      }
      return { count, errors: errs };
    }

    // Process each email independently
    for (const rawEmail of emails) {
      const email = norm(rawEmail);
      const res = {
        email,
        userDeleted: 0,
        profilesDeleted: 0,
        dealsDeleted: 0,
        roomsDeleted: 0,
        messagesDeleted: 0,
        roomMessagesDeleted: 0,
        activitiesDeleted: 0,
        contractsDeleted: 0,
        schedulesDeleted: 0,
        milestonesDeleted: 0,
        legalAgreementsDeleted: 0,
        counterOffersDeleted: 0,
        appointmentsDeleted: 0,
        matchesDeleted: 0,
        introRequestsDeleted: 0,
        profileVectorsDeleted: 0,
        roomParticipantsDeleted: 0,
        ndasDeleted: 0,
        auditLogsDeleted: 0,
        notes: []
      };

      try {
        const asSR = base44.asServiceRole;

        // Locate user + profile by email
        const uRows = await fetchAll(asSR, 'User', { email });
        const userRec = uRows?.[0] || null;

        let profile = (await fetchAll(asSR, 'Profile', { email }))?.[0] || null;
        if (!profile && userRec) {
          profile = (await fetchAll(asSR, 'Profile', { user_id: userRec.id }))?.[0] || null;
        }

        if (!userRec && !profile) {
          res.notes.push('No user/profile found for email');
          summary.results.push(res);
          continue;
        }

        const profileId = profile?.id || null;

        // Gather deals (investor or agent)
        const investorDeals = profileId ? await fetchAll(asSR, 'Deal', { investor_id: profileId }) : [];
        const agentDeals = profileId ? await fetchAll(asSR, 'Deal', { agent_id: profileId }) : [];
        const deals = [...investorDeals, ...agentDeals];

        // Gather rooms by role and by deal
        let rooms = [];
        if (profileId) {
          rooms = [
            ...(await fetchAll(asSR, 'Room', { investorId: profileId })),
            ...(await fetchAll(asSR, 'Room', { agentId: profileId }))
          ];
        }
        const dealIds = [...new Set(deals.map(d => d.id))];
        for (const did of dealIds) {
          const dr = await fetchAll(asSR, 'Room', { deal_id: did });
          for (const r of dr) { if (!rooms.find(x => x.id === r.id)) rooms.push(r); }
        }

        // Delete per-room children then the room
        for (const room of rooms) {
          const rid = room.id;
          const msgs = await fetchAll(asSR, 'Message', { room_id: rid });
          const rmsgs = await fetchAll(asSR, 'RoomMessage', { roomId: rid });
          const acts = await fetchAll(asSR, 'Activity', { room_id: rid });
          const cons = await fetchAll(asSR, 'Contract', { room_id: rid });
          const parts = await fetchAll(asSR, 'RoomParticipant', { room_id: rid });

          res.messagesDeleted += (await deleteArray(asSR, 'Message', msgs)).count;
          res.roomMessagesDeleted += (await deleteArray(asSR, 'RoomMessage', rmsgs)).count;
          res.activitiesDeleted += (await deleteArray(asSR, 'Activity', acts)).count;
          res.contractsDeleted += (await deleteArray(asSR, 'Contract', cons)).count;
          res.roomParticipantsDeleted += (await deleteArray(asSR, 'RoomParticipant', parts)).count;

          try { await asSR.entities.Room.delete(rid); res.roomsDeleted++; } catch (e) { res.notes.push(`Room ${rid} delete failed: ${e?.message || e}`); }
        }

        // Delete per-deal children then the deal
        for (const deal of deals) {
          const did = deal.id;

          const agreements = await fetchAll(asSR, 'LegalAgreement', { deal_id: did });
          const offers = await fetchAll(asSR, 'CounterOffer', { deal_id: did });
          const schedules = await fetchAll(asSR, 'PaymentSchedule', { deal_id: did });
          const milestones = await fetchAll(asSR, 'PaymentMilestone', { deal_id: did });
          const actsByDeal = await fetchAll(asSR, 'Activity', { deal_id: did });
          const appts = await fetchAll(asSR, 'DealAppointments', { dealId: did });

          res.legalAgreementsDeleted += (await deleteArray(asSR, 'LegalAgreement', agreements)).count;
          res.counterOffersDeleted += (await deleteArray(asSR, 'CounterOffer', offers)).count;
          res.milestonesDeleted += (await deleteArray(asSR, 'PaymentMilestone', milestones)).count;
          res.schedulesDeleted += (await deleteArray(asSR, 'PaymentSchedule', schedules)).count;
          res.activitiesDeleted += (await deleteArray(asSR, 'Activity', actsByDeal)).count;
          res.appointmentsDeleted += (await deleteArray(asSR, 'DealAppointments', appts)).count;

          try { await asSR.entities.Deal.delete(did); res.dealsDeleted++; } catch (e) { res.notes.push(`Deal ${did} delete failed: ${e?.message || e}`); }
        }

        // Matches, IntroRequests, ProfileVector
        if (profileId) {
          const m1 = await fetchAll(asSR, 'Match', { investorId: profileId });
          const m2 = await fetchAll(asSR, 'Match', { agentId: profileId });
          res.matchesDeleted += (await deleteArray(asSR, 'Match', [...m1, ...m2])).count;

          const i1 = await fetchAll(asSR, 'IntroRequest', { investorId: profileId });
          const i2 = await fetchAll(asSR, 'IntroRequest', { agentId: profileId });
          res.introRequestsDeleted += (await deleteArray(asSR, 'IntroRequest', [...i1, ...i2])).count;

          const pvs = await fetchAll(asSR, 'ProfileVector', { profile_id: profileId });
          res.profileVectorsDeleted += (await deleteArray(asSR, 'ProfileVector', pvs)).count;

          const audits = await fetchAll(asSR, 'AuditLog', { actor_id: profileId });
          res.auditLogsDeleted += (await deleteArray(asSR, 'AuditLog', audits)).count;
        }

        // NDA by user_id
        if (userRec) {
          const ndas = await fetchAll(asSR, 'NDA', { user_id: userRec.id });
          res.ndasDeleted += (await deleteArray(asSR, 'NDA', ndas)).count;
        }

        // Finally, delete Profile
        if (profileId) {
          try { await asSR.entities.Profile.delete(profileId); res.profilesDeleted++; } catch (e) { res.notes.push(`Profile ${profileId} delete failed: ${e?.message || e}`); }
        }

        // Attempt to delete auth user
        if (userRec) {
          try { await asSR.entities.User.delete(userRec.id); res.userDeleted = 1; } catch (e) { res.notes.push(`User delete failed for ${userRec.id}: ${e?.message || e}`); }
        }

      } catch (e) {
        res.notes.push(`Fatal error: ${e?.message || e}`);
      }

      summary.results.push(res);
    }

    return Response.json({ success: true, ...summary, finishedAt: new Date().toISOString() });
  } catch (error) {
    summary.errors.push(error?.message || String(error));
    return Response.json({ success: false, ...summary, failedAt: new Date().toISOString() }, { status: 500 });
  }
});