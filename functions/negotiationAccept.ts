import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { deal_id, accept } = await req.json();
    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const deals = await base44.entities.Deal.filter({ id: deal_id });
    const deal = deals?.[0];
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    // Only investor can accept/deny
    if (deal.investor_id !== profile.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const existing = (await base44.entities.DealNegotiation.filter({ deal_id }))?.[0];
    if (!existing || !existing.last_proposed_terms) {
      return Response.json({ error: 'No active counter to accept' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (accept === false) {
      const updated = await base44.entities.DealNegotiation.update(existing.id, {
        status: 'NONE',
        history: [ ...(existing.history || []), { ...existing.last_proposed_terms, action: 'DENIED', proposed_at: now } ],
        updated_at: now
      });
      return Response.json({ negotiation: updated });
    }

    // Accept: update deal terms to accepted counter and mark requires regeneration
    const t = existing.last_proposed_terms;
    const patch = { proposed_terms: { ...(deal.proposed_terms || {}) } };
    if (t.buyer_comp_type === 'percentage') {
      patch.proposed_terms.buyer_commission_type = 'percentage';
      patch.proposed_terms.buyer_commission_percentage = Number(t.buyer_comp_amount);
      patch.proposed_terms.buyer_flat_fee = null;
    } else {
      patch.proposed_terms.buyer_commission_type = 'flat';
      patch.proposed_terms.buyer_flat_fee = Number(t.buyer_comp_amount);
      patch.proposed_terms.buyer_commission_percentage = null;
    }
    await base44.entities.Deal.update(deal_id, patch);

    const updated = await base44.entities.DealNegotiation.update(existing.id, {
      current_terms: { buyer_comp_type: t.buyer_comp_type, buyer_comp_amount: t.buyer_comp_amount },
      status: 'ACCEPTED_REQUIRES_REGEN',
      history: [ ...(existing.history || []), { ...t, action: 'ACCEPTED', proposed_at: now } ],
      updated_at: now
    });

    return Response.json({ negotiation: updated });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});