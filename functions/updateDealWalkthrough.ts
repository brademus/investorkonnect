import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dealId, walkthrough_slots } = await req.json();
    if (!dealId) return Response.json({ error: 'Missing dealId' }, { status: 400 });

    const validSlots = (Array.isArray(walkthrough_slots) ? walkthrough_slots : [])
      .filter(s => s.date && String(s.date).length >= 8);

    await base44.asServiceRole.entities.Deal.update(dealId, {
      walkthrough_slots: validSlots,
      walkthrough_confirmed_slot: null,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[updateDealWalkthrough] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});