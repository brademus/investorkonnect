import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { deal_id } = await req.json().catch(() => ({}));
    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const deals = await base44.entities.Deal.filter({ id: deal_id });
    const deal = deals?.[0];
    if (!deal) return Response.json({ error: 'Deal not found' }, { status: 404 });

    // Access: investor or agent on this deal (or selected)
    const isInvestor = deal.investor_id === profile.id;
    const isAgent = deal.agent_id === profile.id;
    if (!isInvestor && !isAgent) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await base44.entities.DealNegotiation.filter({ deal_id });
    const negotiation = rows?.[0] || null;

    return Response.json({ negotiation });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});