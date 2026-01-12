import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dealId = body?.dealId;
    if (!dealId) return Response.json({ error: 'dealId is required' }, { status: 400 });

    const rows = await base44.entities.DealAppointments.filter({ dealId });
    const record = rows?.[0];
    const list = (record?.rescheduleRequests || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return Response.json({ items: list });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});