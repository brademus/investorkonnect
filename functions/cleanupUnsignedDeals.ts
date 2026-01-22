import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// One-time cleanup: delete all current (non-archived) deals without an investor-signed agreement
// Safety: requires { confirm: true } in payload. Uses service role for all operations.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }

    const confirm = payload?.confirm === true;
    const dryRun = payload?.dryRun === true;

    if (!confirm) {
      return Response.json({ error: 'Confirmation required: pass { confirm: true }' }, { status: 400 });
    }

    const sr = base44.asServiceRole;

    // Fetch deals in a single large page (adjust if needed)
    const deals = await sr.entities.Deal.list('-updated_date', 1000);

    const toDelete = [];

    // Determine which deals are missing investor signature
    for (const deal of deals) {
      try {
        if (!deal || deal.status === 'archived') continue;

        const agreements = await sr.entities.LegalAgreement.filter({ deal_id: deal.id });
        const hasInvestorSigned = (agreements || []).some((a) => (
          a?.status === 'investor_signed' || a?.status === 'fully_signed' || Boolean(a?.investor_signed_at)
        ));
        if (!hasInvestorSigned) {
          toDelete.push({ deal, agreements: agreements || [] });
        }
      } catch (_) {
        // If agreement lookup fails, assume no signed agreement and mark for deletion
        toDelete.push({ deal, agreements: [] });
      }
    }

    const result = {
      scannedDeals: deals.length,
      candidates: toDelete.length,
      dryRun,
      deleted: {
        deals: 0,
        rooms: 0,
        messages: 0,
        roomMessages: 0,
        participants: 0,
        contracts: 0,
        activities: 0,
        schedules: 0,
        milestones: 0,
        appointments: 0,
        agreements: 0,
      },
      deletedDealIds: [],
    };

    if (dryRun) {
      return Response.json({ ...result, dealsPreview: toDelete.map((x) => x.deal.id) });
    }

    // Helpers
    const safeFilter = async (entity, filter) => {
      try { return await sr.entities[entity].filter(filter); } catch (_) { return []; }
    };
    const safeDelete = async (entity, id) => {
      try { await sr.entities[entity].delete(id); return true; } catch (_) { return false; }
    };

    for (const item of toDelete) {
      const d = item.deal;
      if (!d?.id) continue;

      // 1) Rooms and children
      const rooms = await safeFilter('Room', { deal_id: d.id });
      for (const room of rooms) {
        const roomId = room.id;
        // Messages (new Message entity)
        const msgs = await safeFilter('Message', { room_id: roomId });
        for (const m of msgs) { if (await safeDelete('Message', m.id)) result.deleted.messages++; }
        // Legacy RoomMessage entity
        const rmsgs = await safeFilter('RoomMessage', { roomId });
        for (const m of rmsgs) { if (await safeDelete('RoomMessage', m.id)) result.deleted.roomMessages++; }
        // Participants
        const parts = await safeFilter('RoomParticipant', { room_id: roomId });
        for (const p of parts) { if (await safeDelete('RoomParticipant', p.id)) result.deleted.participants++; }
        // Contracts
        const contracts = await safeFilter('Contract', { room_id: roomId });
        for (const c of contracts) { if (await safeDelete('Contract', c.id)) result.deleted.contracts++; }
        // Activities linked to room
        const roomActs = await safeFilter('Activity', { room_id: roomId });
        for (const a of roomActs) { if (await safeDelete('Activity', a.id)) result.deleted.activities++; }
        // Delete room itself
        if (await safeDelete('Room', roomId)) result.deleted.rooms++;
      }

      // 2) Activities linked to deal
      const dealActs = await safeFilter('Activity', { deal_id: d.id });
      for (const a of dealActs) { if (await safeDelete('Activity', a.id)) result.deleted.activities++; }

      // 3) Payment schedules and milestones
      const schedules = await safeFilter('PaymentSchedule', { deal_id: d.id });
      for (const s of schedules) {
        const milestones = await safeFilter('PaymentMilestone', { schedule_id: s.id });
        for (const m of milestones) { if (await safeDelete('PaymentMilestone', m.id)) result.deleted.milestones++; }
        if (await safeDelete('PaymentSchedule', s.id)) result.deleted.schedules++;
      }

      // 4) Deal Appointments (attribute is dealId per frontend usage)
      const appts = await safeFilter('DealAppointments', { dealId: d.id });
      for (const a of appts) { if (await safeDelete('DealAppointments', a.id)) result.deleted.appointments++; }

      // 5) Legal Agreements for this deal
      const las = await safeFilter('LegalAgreement', { deal_id: d.id });
      for (const la of las) { if (await safeDelete('LegalAgreement', la.id)) result.deleted.agreements++; }

      // 6) Finally, delete the deal
      if (await safeDelete('Deal', d.id)) {
        result.deleted.deals++;
        result.deletedDealIds.push(d.id);
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});