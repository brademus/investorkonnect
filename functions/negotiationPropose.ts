import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { deal_id, buyer_comp_type, buyer_comp_amount } = await req.json();
    if (!deal_id || !buyer_comp_type || typeof buyer_comp_amount !== 'number') {
      return Response.json({ error: 'deal_id, buyer_comp_type, buyer_comp_amount required' }, { status: 400 });
    }
    if (!['percentage','flat'].includes(buyer_comp_type)) {
      return Response.json({ error: 'Invalid comp type' }, { status: 400 });
    }
    if (buyer_comp_amount <= 0) {
      return Response.json({ error: 'Comp amount must be > 0' }, { status: 400 });
    }

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const deals = await base44.entities.Deal.filter({ id: deal_id });
    const deal = deals?.[0];
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    const role = profile.user_role;
    const isInvestor = deal.investor_id === profile.id && role === 'investor';
    const isAgent = role === 'agent';
    if (!isInvestor && !isAgent) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const existing = (await base44.entities.DealNegotiation.filter({ deal_id }))?.[0] || null;
    const now = new Date().toISOString();

    const proposal = {
      buyer_comp_type,
      buyer_comp_amount,
      proposed_by_role: isAgent ? 'agent' : 'investor',
      proposed_by_user_id: profile.id,
      proposed_at: now
    };

    if (!existing) {
      const created = await base44.entities.DealNegotiation.create({
        deal_id,
        last_proposed_terms: proposal,
        status: isAgent ? 'COUNTERED_BY_AGENT' : 'COUNTERED_BY_INVESTOR',
        history: [{ ...proposal, action: 'PROPOSED' }],
        updated_at: now
      });
      return Response.json({ negotiation: created });
    } else {
      const updated = await base44.entities.DealNegotiation.update(existing.id, {
        last_proposed_terms: proposal,
        status: isAgent ? 'COUNTERED_BY_AGENT' : 'COUNTERED_BY_INVESTOR',
        history: [ ...(existing.history || []), { ...proposal, action: 'PROPOSED' } ],
        updated_at: now
      });
      return Response.json({ negotiation: updated });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});