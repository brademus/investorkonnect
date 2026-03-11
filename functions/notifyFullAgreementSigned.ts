import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    if (event?.type !== 'update' || !data) return Response.json({ ok: true });
    if (data.status !== 'fully_signed') return Response.json({ ok: true });
    if (old_data?.status === 'fully_signed') return Response.json({ ok: true });

    const roomId = data.room_id;
    if (!roomId) return Response.json({ error: 'No room_id' }, { status: 400 });

    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    const room = rooms?.[0];
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: room.investorId });
    const investor = investorProfiles?.[0];
    if (!investor) return Response.json({ error: 'Investor not found' }, { status: 404 });

    const agentId = room.locked_agent_id || room.agent_ids?.[0];
    const agentProfiles = agentId
      ? await base44.asServiceRole.entities.Profile.filter({ id: agentId })
      : [];
    const agent = agentProfiles?.[0];

    const address = room.property_address || room.title || 'the property';

    const send = async (to, name, role) => {
      if (!to) return;
      const opposite = role === 'investor' ? 'agent' : 'investor';
      await base44.asServiceRole.integrations.Core.SendEmail({
        to,
        subject: `Agreement signed — ${address}`,
        body: `Hi ${name || 'there'},

Both parties have signed the agreement for ${address}.

You can now message the ${opposite} and access the full deal room.

Log in to get started: https://investorkonnect.com

— Investor Konnect`,
      });
    };

    await Promise.all([
      send(investor.email, investor.full_name?.split(' ')[0], 'investor'),
      agent ? send(agent.email, agent.full_name?.split(' ')[0], 'agent') : Promise.resolve(),
    ]);

    const sms = `Agreement signed for ${address}. Log in to view next steps — investorkonnect.com`;
    const sendSms = async (profile) => {
      if (profile?.notification_preferences?.text && profile.phone) {
        await base44.asServiceRole.functions.invoke('sendSms', { to: profile.phone, message: sms }).catch(() => {});
      }
    };
    await Promise.all([sendSms(investor), agent ? sendSms(agent) : Promise.resolve()]);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});