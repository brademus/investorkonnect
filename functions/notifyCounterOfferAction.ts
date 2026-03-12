import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    if (event?.type !== 'update' || !data || !old_data) return Response.json({ ok: true });

    const statusChanged = data.status !== old_data.status;
    const isResolved = data.status === 'accepted' || data.status === 'declined';
    if (!statusChanged || !isResolved) return Response.json({ ok: true });

    const rooms = await base44.asServiceRole.entities.Room.filter({ id: data.room_id });
    const room = rooms?.[0];
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    const senderProfileId = data.from_role === 'investor' ? room.investorId : room.agentId;
    const senderProfiles = await base44.asServiceRole.entities.Profile.filter({ id: senderProfileId });
    const sender = senderProfiles?.[0];
    if (!sender) return Response.json({ ok: true });

    const address = room.property_address || room.title || 'the property';
    const action = data.status === 'accepted' ? 'accepted' : 'declined';
    const firstName = sender.full_name?.split(' ')[0] || 'there';

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: sender.email,
      subject: `Counter offer ${action} — ${address}`,
      body: action === 'accepted'
        ? `${firstName}, your counter offer for ${address} was accepted. Log in to review the updated terms.\n\nhttps://investorkonnect.com`
        : `${firstName}, your counter offer for ${address} was declined. You can submit a new offer or continue with the original terms.\n\nhttps://investorkonnect.com`,
    });

    if (sender.notification_preferences?.text && sender.phone) {
      const sms = `Your counter offer for ${address} was ${action}. Log in to view — investorkonnect.com`;
      await base44.asServiceRole.functions.invoke('sendSms', { to: sender.phone, message: sms }).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});