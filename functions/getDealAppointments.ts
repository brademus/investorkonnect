import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DEFAULT_EVENT = (nowTz) => ({
  status: 'NOT_SET',
  datetime: null,
  timezone: nowTz || null,
  locationType: null,
  notes: null,
  updatedByUserId: null,
  updatedAt: null,
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dealId = body?.dealId;
    if (!dealId) return Response.json({ error: 'dealId is required' }, { status: 400 });

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const rows = await base44.entities.DealAppointments.filter({ dealId });
    const existing = rows?.[0];

    if (!existing) {
      return Response.json({
        dealId,
        walkthrough: DEFAULT_EVENT(tz),
        inspection: DEFAULT_EVENT(tz),
        rescheduleRequests: [],
      });
    }
    return Response.json(existing);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});