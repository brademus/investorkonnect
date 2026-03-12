import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Confirm or decline a walkthrough.
 * Uses asServiceRole so both agents AND investors can update
 * DealAppointments, Deal, and Message entities regardless of ownership.
 *
 * Payload: { action, dealId, roomId, wtDate?, wtTime? }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, dealId, roomId, wtDate, wtTime } = body || {};

    if (!action || !dealId) {
      return Response.json({ error: 'action and dealId required' }, { status: 400 });
    }

    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const profileId = profile.id;
    const isConfirm = action === 'confirm';
    const apptStatus = isConfirm ? 'SCHEDULED' : 'CANCELED';
    const msgStatus = isConfirm ? 'confirmed' : 'denied';
    const now = new Date().toISOString();

    const displayParts = [wtDate, wtTime].filter(Boolean);
    const displayText = displayParts.length > 0 ? displayParts.join(' at ') : 'TBD';

    // 1. Update DealAppointments
    const apptRows = await base44.asServiceRole.entities.DealAppointments.filter({ dealId });
    if (apptRows && apptRows[0]) {
      await base44.asServiceRole.entities.DealAppointments.update(apptRows[0].id, {
        walkthrough: {
          ...(apptRows[0].walkthrough || {}),
          status: apptStatus,
          updatedByUserId: profileId,
          updatedAt: now,
          ...(isConfirm && wtDate ? { datetime: wtDate + (wtTime ? 'T' + wtTime : '') } : {}),
        },
      });
      console.log('[respondToWalkthrough] Updated DealAppointments:', apptRows[0].id);
    } else {
      await base44.asServiceRole.entities.DealAppointments.create({
        dealId,
        walkthrough: {
          status: apptStatus,
          datetime: isConfirm && wtDate ? wtDate + (wtTime ? 'T' + wtTime : '') : null,
          timezone: null,
          locationType: 'ON_SITE',
          notes: null,
          updatedByUserId: profileId,
          updatedAt: now,
        },
      });
      console.log('[respondToWalkthrough] Created DealAppointments for deal:', dealId);
    }

    // 2. Update Deal with confirmed walkthrough info
    if (isConfirm) {
      await base44.asServiceRole.entities.Deal.update(dealId, {
        walkthrough_confirmed: true,
        walkthrough_confirmed_date: wtDate || null,
        walkthrough_confirmed_time: wtTime || null,
      });
      console.log('[respondToWalkthrough] Updated Deal with confirmed walkthrough');
    }

    // 3. Update pending walkthrough_request messages
    if (roomId) {
      const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: roomId });
      const pendingWt = (msgs || []).filter(
        function(m) { return m.metadata && m.metadata.type === 'walkthrough_request' && m.metadata.status === 'pending'; }
      );
      for (const m of pendingWt) {
        await base44.asServiceRole.entities.Message.update(m.id, {
          metadata: {
            ...m.metadata,
            status: msgStatus,
            responded_by: profileId,
            responded_at: now,
            ...(isConfirm ? { confirmed_date: wtDate, confirmed_time: wtTime } : {}),
          },
        });
      }
      console.log('[respondToWalkthrough] Updated ' + pendingWt.length + ' pending walkthrough messages');

      // 4. Send reply message
      const emoji = isConfirm ? '✅' : '❌';
      const label = isConfirm ? 'Confirmed' : 'Declined';
      await base44.asServiceRole.entities.Message.create({
        room_id: roomId,
        sender_profile_id: profileId,
        body: emoji + ' Walk-through ' + label + '\n\n' + (isConfirm ? 'See you on ' + displayText : 'Please propose a different time.'),
        metadata: {
          type: 'walkthrough_response',
          walkthrough_date: wtDate || null,
          walkthrough_time: wtTime || null,
          status: msgStatus,
        },
      });
      console.log('[respondToWalkthrough] Sent reply message');
    }

    return Response.json({ ok: true, status: apptStatus });
  } catch (error) {
    console.error('[respondToWalkthrough] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});