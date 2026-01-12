import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function ensureDefault(dealId, tz) {
  return {
    dealId,
    walkthrough: { status: 'NOT_SET', datetime: null, timezone: tz || null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
    inspection: { status: 'NOT_SET', datetime: null, timezone: tz || null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
    rescheduleRequests: [],
  };
}

function rid() {
  return 'rr_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { dealId, eventType, message } = body || {};
    if (!dealId || !eventType || !message) {
      return Response.json({ error: 'dealId, eventType, and message are required' }, { status: 400 });
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rows = await base44.entities.DealAppointments.filter({ dealId });
    const record = rows?.[0] || ensureDefault(dealId, tz);

    const reqItem = {
      id: rid(),
      dealId,
      eventType,
      requestedByUserId: user.id,
      message,
      createdAt: new Date().toISOString(),
    };

    const next = { ...record, rescheduleRequests: [ ...(record.rescheduleRequests || []), reqItem ] };

    let saved;
    if (record?.id) saved = await base44.entities.DealAppointments.update(record.id, next);
    else saved = await base44.entities.DealAppointments.create(next);

    return Response.json({ success: true, request: reqItem });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});