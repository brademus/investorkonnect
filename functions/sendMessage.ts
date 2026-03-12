import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { room_id, body } = await req.json();
    const text = (body || '').trim();
    if (!room_id || !text) return Response.json({ error: 'room_id and body required' }, { status: 400 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    let room = null;
    try { room = await base44.asServiceRole.entities.Room.get(room_id); } catch (_) {}
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    const isParticipant = room.investorId === profile.id ||
      room.agent_ids?.includes(profile.id) ||
      room.agentId === profile.id;
    if (!isParticipant) return Response.json({ error: 'Access denied' }, { status: 403 });

    let canChat = room.agreement_status === 'fully_signed' || room.request_status === 'signed';
    if (!canChat && room.deal_id) {
      const ags = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: room.deal_id });
      canChat = ags?.some((a) => a.status === 'fully_signed');
    }
    if (!canChat) return Response.json({ error: 'Chat unlocks after both parties sign.', ok: false }, { status: 403 });

    const message = await base44.asServiceRole.entities.Message.create({
      room_id, sender_profile_id: profile.id, body: text
    });

    try {
      const allIds = [room.investorId, ...(room.agent_ids || [])].filter(Boolean);
      const otherIds = allIds.filter(id => id !== profile.id);

      for (const pid of otherIds) {
        let p = null;
        try { p = await base44.asServiceRole.entities.Profile.get(pid); } catch (_) { continue; }
        if (!p?.email) continue;

        const address = room.property_address?.split(',')[0] || room.title || 'your deal';
        const senderName = profile.full_name || 'Your counterpart';
        const firstName = p.full_name?.split(' ')[0] || 'there';

        if (p.notification_preferences?.email !== false) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: p.email,
            subject: `New message — ${address}`,
            body: `${firstName}, you have a new message from ${senderName} about ${address}.`,
          }).catch(() => {});
        }

        if (p.notification_preferences?.text && p.phone) {
          await base44.asServiceRole.functions.invoke('sendSms', {
            to: p.phone,
            message: `New message from ${senderName} about ${address}.`
          }).catch(() => {});
        }
      }
    } catch (notifyErr) {
      console.warn('[sendMessage] Notification error (non-fatal):', notifyErr.message);
    }

    return Response.json({ ok: true, message });
  } catch (error) {
    console.error('[sendMessage] Error:', error);
    return Response.json({ error: error.message, ok: false }, { status: error?.status || 500 });
  }
});