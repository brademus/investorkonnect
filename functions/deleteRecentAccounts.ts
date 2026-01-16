import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Admin-only utility to delete the two most recently created accounts
// - Identifies last two Profiles by created_date DESC
// - Deletes all Deals where investor_id or agent_id matches those profiles
// - Cascades deletion to deal-linked records (rooms, messages, payments, appointments, activities, legal agreements, contracts)
// - Deletes auxiliary links (matches/introRequests/profile vectors)
// - Deletes the Profile and attempts to delete the underlying auth User
// Returns a summary report

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const report = { targets: [], deleted: { profiles: 0, users: 0, deals: 0, rooms: 0, messages: 0, roomMessages: 0, roomParticipants: 0, contracts: 0, payments: { schedules: 0, milestones: 0 }, appointments: 0, activities: 0, legalAgreements: 0, matches: 0, introRequests: 0, profileVectors: 0 }, errors: [] };

    // Get two most recently created profiles
    const profiles = await base44.asServiceRole.entities.Profile.list('-created_date', 2);

    for (const profile of profiles) {
      report.targets.push({ profile_id: profile.id, email: profile.email, role: profile.user_role, created_date: profile.created_date });

      // Gather deals for this profile (as investor or agent)
      const dealsInvestor = await base44.asServiceRole.entities.Deal.filter({ investor_id: profile.id });
      const dealsAgent = await base44.asServiceRole.entities.Deal.filter({ agent_id: profile.id });
      const dealsMap = new Map();
      [...dealsInvestor, ...dealsAgent].forEach((d) => dealsMap.set(d.id, d));
      const deals = Array.from(dealsMap.values());

      for (const deal of deals) {
        // Delete payments (schedules + milestones)
        try {
          const schedules = await base44.asServiceRole.entities.PaymentSchedule.filter({ deal_id: deal.id });
          for (const s of schedules) {
            try { await base44.asServiceRole.entities.PaymentSchedule.delete(s.id); report.deleted.payments.schedules++; } catch (e) { report.errors.push(`PaymentSchedule ${s.id} delete failed: ${e?.message || e}`); }
          }
        } catch (e) { report.errors.push(`List PaymentSchedule failed for deal ${deal.id}: ${e?.message || e}`); }
        try {
          const milestones = await base44.asServiceRole.entities.PaymentMilestone.filter({ deal_id: deal.id });
          for (const m of milestones) {
            try { await base44.asServiceRole.entities.PaymentMilestone.delete(m.id); report.deleted.payments.milestones++; } catch (e) { report.errors.push(`PaymentMilestone ${m.id} delete failed: ${e?.message || e}`); }
          }
        } catch (e) { report.errors.push(`List PaymentMilestone failed for deal ${deal.id}: ${e?.message || e}`); }

        // Delete appointments
        try {
          const appts = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: deal.id });
          for (const a of appts) {
            try { await base44.asServiceRole.entities.DealAppointments.delete(a.id); report.deleted.appointments++; } catch (e) { report.errors.push(`DealAppointments ${a.id} delete failed: ${e?.message || e}`); }
          }
        } catch (e) { report.errors.push(`List DealAppointments failed for deal ${deal.id}: ${e?.message || e}`); }

        // Delete activities
        try {
          const acts = await base44.asServiceRole.entities.Activity.filter({ deal_id: deal.id });
          for (const a of acts) {
            try { await base44.asServiceRole.entities.Activity.delete(a.id); report.deleted.activities++; } catch (e) { report.errors.push(`Activity ${a.id} delete failed: ${e?.message || e}`); }
          }
        } catch (e) { report.errors.push(`List Activity failed for deal ${deal.id}: ${e?.message || e}`); }

        // Delete legal agreements
        try {
          const las = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal.id });
          for (const la of las) {
            try { await base44.asServiceRole.entities.LegalAgreement.delete(la.id); report.deleted.legalAgreements++; } catch (e) { report.errors.push(`LegalAgreement ${la.id} delete failed: ${e?.message || e}`); }
          }
        } catch (e) { report.errors.push(`List LegalAgreement failed for deal ${deal.id}: ${e?.message || e}`); }

        // Rooms and nested entities
        try {
          const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
          for (const room of rooms) {
            // Messages (two entities)
            try {
              const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: room.id });
              for (const msg of msgs) { try { await base44.asServiceRole.entities.Message.delete(msg.id); report.deleted.messages++; } catch (e) { report.errors.push(`Message ${msg.id} delete failed: ${e?.message || e}`); } }
            } catch (e) { report.errors.push(`List Message failed for room ${room.id}: ${e?.message || e}`); }
            try {
              const rmsgs = await base44.asServiceRole.entities.RoomMessage.filter({ roomId: room.id });
              for (const r of rmsgs) { try { await base44.asServiceRole.entities.RoomMessage.delete(r.id); report.deleted.roomMessages++; } catch (e) { report.errors.push(`RoomMessage ${r.id} delete failed: ${e?.message || e}`); } }
            } catch (e) { report.errors.push(`List RoomMessage failed for room ${room.id}: ${e?.message || e}`); }

            // Participants
            try {
              const parts = await base44.asServiceRole.entities.RoomParticipant.filter({ room_id: room.id });
              for (const p of parts) { try { await base44.asServiceRole.entities.RoomParticipant.delete(p.id); report.deleted.roomParticipants++; } catch (e) { report.errors.push(`RoomParticipant ${p.id} delete failed: ${e?.message || e}`); } }
            } catch (e) { report.errors.push(`List RoomParticipant failed for room ${room.id}: ${e?.message || e}`); }

            // Contracts bound to room
            try {
              const contracts = await base44.asServiceRole.entities.Contract.filter({ room_id: room.id });
              for (const c of contracts) { try { await base44.asServiceRole.entities.Contract.delete(c.id); report.deleted.contracts++; } catch (e) { report.errors.push(`Contract ${c.id} delete failed: ${e?.message || e}`); } }
            } catch (e) { report.errors.push(`List Contract failed for room ${room.id}: ${e?.message || e}`); }

            // Finally, room itself
            try { await base44.asServiceRole.entities.Room.delete(room.id); report.deleted.rooms++; } catch (e) { report.errors.push(`Room ${room.id} delete failed: ${e?.message || e}`); }
          }
        } catch (e) { report.errors.push(`List Room failed for deal ${deal.id}: ${e?.message || e}`); }

        // Delete the deal
        try { await base44.asServiceRole.entities.Deal.delete(deal.id); report.deleted.deals++; } catch (e) { report.errors.push(`Deal ${deal.id} delete failed: ${e?.message || e}`); }
      }

      // Matches and intro requests referencing the profile
      try {
        const m1 = await base44.asServiceRole.entities.Match.filter({ investorId: profile.id });
        const m2 = await base44.asServiceRole.entities.Match.filter({ agentId: profile.id });
        for (const m of [...m1, ...m2]) { try { await base44.asServiceRole.entities.Match.delete(m.id); report.deleted.matches++; } catch (e) { report.errors.push(`Match ${m.id} delete failed: ${e?.message || e}`); } }
      } catch (e) { report.errors.push(`List Match failed for profile ${profile.id}: ${e?.message || e}`); }
      try {
        const i1 = await base44.asServiceRole.entities.IntroRequest.filter({ investorId: profile.id });
        const i2 = await base44.asServiceRole.entities.IntroRequest.filter({ agentId: profile.id });
        for (const i of [...i1, ...i2]) { try { await base44.asServiceRole.entities.IntroRequest.delete(i.id); report.deleted.introRequests++; } catch (e) { report.errors.push(`IntroRequest ${i.id} delete failed: ${e?.message || e}`); } }
      } catch (e) { report.errors.push(`List IntroRequest failed for profile ${profile.id}: ${e?.message || e}`); }

      // ProfileVector
      try {
        const pvs = await base44.asServiceRole.entities.ProfileVector.filter({ profile_id: profile.id });
        for (const pv of pvs) { try { await base44.asServiceRole.entities.ProfileVector.delete(pv.id); report.deleted.profileVectors++; } catch (e) { report.errors.push(`ProfileVector ${pv.id} delete failed: ${e?.message || e}`); } }
      } catch (e) { report.errors.push(`List ProfileVector failed for profile ${profile.id}: ${e?.message || e}`); }

      // Delete Profile
      try { await base44.asServiceRole.entities.Profile.delete(profile.id); report.deleted.profiles++; } catch (e) { report.errors.push(`Profile ${profile.id} delete failed: ${e?.message || e}`); }

      // Attempt to delete the underlying auth user (if exists)
      if (profile.user_id) {
        try {
          await base44.asServiceRole.entities.User.delete(profile.user_id);
          report.deleted.users++;
        } catch (e) {
          // Not all environments allow deleting auth users via entities API; continue
          report.errors.push(`Auth user delete failed for user_id ${profile.user_id}: ${e?.message || e}`);
        }
      }
    }

    return Response.json({ success: true, report });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});