import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Returns lightweight pending deal requests for the current agent
// Minimizes round trips by batching with $in filters and simple projections
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile to ensure agent role
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile || profile.user_role !== 'agent') {
      return Response.json({ requests: [] });
    }

    // Fetch this agent's rooms that are actionable and not fully signed
    // Filter on server to reduce payload
    const rooms = await base44.entities.Room.filter({
      agentId: profile.id,
      request_status: { $in: ['requested', 'accepted'] },
      agreement_status: { $ne: 'fully_signed' },
      is_orphan: { $ne: true },
    });

    if (!rooms || rooms.length === 0) {
      return Response.json({ requests: [] });
    }

    // Keep the latest room per deal_id
    const byDeal = new Map();
    for (const r of rooms) {
      if (!r?.deal_id || !r?.investorId) continue;
      const prev = byDeal.get(r.deal_id);
      const tA = new Date(r.updated_date || r.created_date || 0).getTime();
      const tB = prev ? new Date(prev.updated_date || prev.created_date || 0).getTime() : -1;
      if (!prev || tA > tB) byDeal.set(r.deal_id, r);
    }

    const list = Array.from(byDeal.values());
    if (list.length === 0) {
      return Response.json({ requests: [] });
    }

    // Validate underlying deals in one batch and exclude archived
    const dealIds = Array.from(new Set(list.map(r => r.deal_id)));
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: { $in: dealIds } });
    const dealById = new Map(deals.map(d => [d.id, d]));

    // Also check for other rooms that may have been accepted/signed for these deals (lock out)
    const otherRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: { $in: dealIds } });
    const lockedDeals = new Set();
    otherRooms.forEach(rr => {
      if (rr?.request_status === 'accepted' || rr?.request_status === 'signed' || rr?.agreement_status === 'fully_signed') {
        lockedDeals.add(rr.deal_id);
      }
    });

    // Build lightweight response objects
    const requests = list
      .filter(r => {
        const d = dealById.get(r.deal_id);
        return d && d.status !== 'archived' && r.investorId === d.investor_id && !lockedDeals.has(r.deal_id);
      })
      .map(r => {
        const d = dealById.get(r.deal_id) || {};
        return {
          id: r.id,
          deal_id: r.deal_id,
          city: d.city || r.city || null,
          state: d.state || r.state || null,
          budget: d.purchase_price || r.budget || null,
          request_status: r.request_status,
          agreement_status: r.agreement_status,
          updated_date: r.updated_date,
          created_date: r.created_date,
        };
      })
      .sort((a, b) => new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0));

    return Response.json({ requests });
  } catch (error) {
    console.error('getAgentPendingRequests error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});