import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { deal_id } = await req.json().catch(() => ({}));
    if (!deal_id) return Response.json({ error: 'deal_id is required' }, { status: 400 });

    // Fetch deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    const deal = deals[0];
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    // Authorize: admin or participant (investor/agent)
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    const isAdmin = user.role === 'admin' || profile?.role === 'admin';
    const isParticipant = profile && (deal.investor_id === profile.id || deal.agent_id === profile.id);
    if (!isAdmin && !isParticipant) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Collect related data
    const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    const roomIds = rooms.map(r => r.id);

    // Delete children (best-effort)
    const results = { rooms: rooms.length };

    // Messages
    try {
      if (roomIds.length) {
        const msgs = await base44.asServiceRole.entities.RoomMessage.filter({ roomId: { $in: roomIds } });
        results.messages = msgs.length;
        for (const m of msgs) await base44.asServiceRole.entities.RoomMessage.delete(m.id);
      } else results.messages = 0;
    } catch (e) { results.messages = results.messages ?? 0; }

    // Activities
    try {
      const acts = await base44.asServiceRole.entities.Activity.filter({ deal_id });
      results.activities = acts.length;
      for (const a of acts) await base44.asServiceRole.entities.Activity.delete(a.id);
    } catch (e) { results.activities = results.activities ?? 0; }

    // Payment milestones & schedules
    try {
      const mls = await base44.asServiceRole.entities.PaymentMilestone.filter({ deal_id });
      results.milestones = mls.length;
      for (const m of mls) await base44.asServiceRole.entities.PaymentMilestone.delete(m.id);
    } catch (e) { results.milestones = results.milestones ?? 0; }

    try {
      const sch = await base44.asServiceRole.entities.PaymentSchedule.filter({ deal_id });
      results.schedules = sch.length;
      for (const s of sch) await base44.asServiceRole.entities.PaymentSchedule.delete(s.id);
    } catch (e) { results.schedules = results.schedules ?? 0; }

    // Contracts
    try {
      if (roomIds.length) {
        const cons = await base44.asServiceRole.entities.Contract.filter({ room_id: { $in: roomIds } });
        results.contracts = cons.length;
        for (const c of cons) await base44.asServiceRole.entities.Contract.delete(c.id);
      } else results.contracts = 0;
    } catch (e) { results.contracts = results.contracts ?? 0; }

    // LegalAgreement
    try {
      const las = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
      results.agreements = las.length;
      for (const g of las) await base44.asServiceRole.entities.LegalAgreement.delete(g.id);
    } catch (e) { results.agreements = results.agreements ?? 0; }

    // CounterOffers
    try {
      const offers = await base44.asServiceRole.entities.CounterOffer.filter({ deal_id });
      results.offers = offers.length;
      for (const o of offers) await base44.asServiceRole.entities.CounterOffer.delete(o.id);
    } catch (e) { results.offers = results.offers ?? 0; }

    // Rooms
    try {
      for (const r of rooms) await base44.asServiceRole.entities.Room.delete(r.id);
    } catch (_) {}

    // Finally, delete the deal
    await base44.asServiceRole.entities.Deal.delete(deal_id);

    results.deals = 1;

    return Response.json({ success: true, deleted: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});