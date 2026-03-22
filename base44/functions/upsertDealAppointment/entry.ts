import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function ensureDefault(record, dealId, tz) {
  if (!record) {
    return {
      dealId,
      walkthrough: { status: 'NOT_SET', datetime: null, timezone: tz || null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
      inspection: { status: 'NOT_SET', datetime: null, timezone: tz || null, locationType: null, notes: null, updatedByUserId: null, updatedAt: null },
      rescheduleRequests: [],
    };
  }
  return record;
}

const ALLOWED_STATUS = new Set(['NOT_SET','PROPOSED','SCHEDULED','COMPLETED','CANCELED']);
const ALLOWED_LOC = new Set(['ON_SITE','VIRTUAL']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { dealId, eventType, patch } = body || {};
    if (!dealId || !eventType || !patch) {
      return Response.json({ error: 'dealId, eventType, and patch are required' }, { status: 400 });
    }

    // Role check: Agent only
    let role = user.role;
    if (role !== 'admin') {
      try {
        const profs = await base44.entities.Profile.filter({ user_id: user.id });
        role = profs?.[0]?.user_role || profs?.[0]?.role || role;
      } catch (_) {}
    }
    if (role !== 'agent' && role !== 'admin') {
      return Response.json({ error: 'Forbidden: Only agents can set official schedule' }, { status: 403 });
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const rows = await base44.entities.DealAppointments.filter({ dealId });
    const existing = ensureDefault(rows?.[0], dealId, tz);

    const key = eventType === 'WALKTHROUGH' ? 'walkthrough' : 'inspection';
    const next = { ...(existing[key] || {}) };

    if (patch.status) {
      if (!ALLOWED_STATUS.has(patch.status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
      next.status = patch.status;
    }
    if (patch.datetime !== undefined) next.datetime = patch.datetime || null;
    if (patch.timezone !== undefined) next.timezone = patch.timezone || tz || null;
    if (patch.locationType !== undefined) {
      if (patch.locationType !== null && !ALLOWED_LOC.has(patch.locationType)) return Response.json({ error: 'Invalid locationType' }, { status: 400 });
      next.locationType = patch.locationType;
    }
    if (patch.notes !== undefined) next.notes = patch.notes || null;

    next.updatedByUserId = user.id;
    next.updatedAt = new Date().toISOString();

    const updatedRecord = { ...existing, [key]: next };

    if (existing?.id) {
      const saved = await base44.entities.DealAppointments.update(existing.id, updatedRecord);
      return Response.json(saved);
    } else {
      const created = await base44.entities.DealAppointments.create(updatedRecord);
      return Response.json(created);
    }
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});