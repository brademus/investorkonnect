import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const isAutomation = !user; // scheduled automation calls have no end-user
    // Admin only safeguard for interactive calls
    if (!isAutomation && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Load all deals and agreements
    const allDeals = await base44.asServiceRole.entities.Deal.list('-created_date', 10000);
    const dealIds = allDeals.map(d => d.id);

    // Map agreements by deal
    const agreements = dealIds.length
      ? await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: dealIds } })
      : [];
    const agByDeal = new Map(agreements.map(a => [a.deal_id, a]));

    // Select deals to delete: no agreement OR agreement without investor signature
    const toDeleteDealIds = allDeals
      .filter(d => {
        const ag = agByDeal.get(d.id);
        return !ag || !ag.investor_signed_at; // investor has not signed
      })
      .map(d => d.id);

    // Gather related entities for cleanup
    const rooms = toDeleteDealIds.length ? await base44.asServiceRole.entities.Room.filter({ deal_id: { $in: toDeleteDealIds } }) : [];
    const roomIds = rooms.map(r => r.id);

    // Delete in safe order
    let deleted = { deals: 0, rooms: 0, messages: 0, activities: 0, agreements: 0, schedules: 0, milestones: 0, contracts: 0 };

    // Messages
    if (roomIds.length) {
      const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: { $in: roomIds } });
      for (const m of msgs) {
        await base44.asServiceRole.entities.Message.delete(m.id).catch(() => {});
        deleted.messages++;
      }
    }

    // Activities
    if (toDeleteDealIds.length) {
      const acts = await base44.asServiceRole.entities.Activity.filter({ deal_id: { $in: toDeleteDealIds } });
      for (const a of acts) {
        await base44.asServiceRole.entities.Activity.delete(a.id).catch(() => {});
        deleted.activities++;
      }
    }

    // PaymentMilestones & PaymentSchedules
    if (toDeleteDealIds.length) {
      const milestones = await base44.asServiceRole.entities.PaymentMilestone.filter({ deal_id: { $in: toDeleteDealIds } });
      for (const m of milestones) {
        await base44.asServiceRole.entities.PaymentMilestone.delete(m.id).catch(() => {});
        deleted.milestones++;
      }
      const schedules = await base44.asServiceRole.entities.PaymentSchedule.filter({ deal_id: { $in: toDeleteDealIds } });
      for (const s of schedules) {
        await base44.asServiceRole.entities.PaymentSchedule.delete(s.id).catch(() => {});
        deleted.schedules++;
      }
    }

    // Contracts
    if (toDeleteDealIds.length) {
      const contracts = await base44.asServiceRole.entities.Contract.filter({ room_id: { $in: roomIds } });
      for (const c of contracts) {
        await base44.asServiceRole.entities.Contract.delete(c.id).catch(() => {});
        deleted.contracts++;
      }
    }

    // Agreements
    if (toDeleteDealIds.length) {
      const ags = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: toDeleteDealIds } });
      for (const a of ags) {
        await base44.asServiceRole.entities.LegalAgreement.delete(a.id).catch(() => {});
        deleted.agreements++;
      }
    }

    // Rooms
    for (const r of rooms) {
      await base44.asServiceRole.entities.Room.delete(r.id).catch(() => {});
      deleted.rooms++;
    }

    // Deals
    for (const id of toDeleteDealIds) {
      await base44.asServiceRole.entities.Deal.delete(id).catch(() => {});
      deleted.deals++;
    }

    return Response.json({ success: true, deleted, totalDealsChecked: allDeals.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});