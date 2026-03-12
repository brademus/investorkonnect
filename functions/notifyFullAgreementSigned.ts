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

    // --- INVESTOR EMAIL ---
    if (investor?.email) {
      const firstName = investor.full_name?.split(' ')[0] || 'there';
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: investor.email,
        subject: `Agreement signed — ${address}`,
        body: `${firstName}, your agent has signed the agreement for ${address}. Your deal room is now open.`,
      });
    }

    // --- AGENT EMAIL ---
    if (agent?.email) {
      const firstName = agent.full_name?.split(' ')[0] || 'there';
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: agent.email,
        subject: `Agreement signed — ${address}`,
        body: `${firstName}, the investor has signed the agreement for ${address}. Your deal room is now open.`,
      });
    }

    // Investor SMS
    if (investor?.notification_preferences?.text && investor.phone) {
      await base44.asServiceRole.functions.invoke('sendSms', {
        to: investor.phone,
        message: `Your agent signed the agreement for ${address}. Deal room is open.`
      }).catch(() => {});
    }

    // Agent SMS
    if (agent?.notification_preferences?.text && agent.phone) {
      await base44.asServiceRole.functions.invoke('sendSms', {
        to: agent.phone,
        message: `Investor signed the agreement for ${address}. Deal room is open.`
      }).catch(() => {});
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});