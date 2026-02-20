import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dealId, roomId, slots, profileId } = await req.json();

    if (!dealId || !roomId || !Array.isArray(slots) || slots.length === 0) {
      return Response.json({ error: 'Missing required fields: dealId, roomId, slots' }, { status: 400 });
    }

    const validSlots = slots.filter(s => s.date && String(s.date).length >= 8);
    if (validSlots.length === 0) {
      return Response.json({ error: 'No valid walkthrough slots provided' }, { status: 400 });
    }

    // 1. Save slots on Deal using service role
    await base44.asServiceRole.entities.Deal.update(dealId, {
      walkthrough_slots: validSlots,
      walkthrough_confirmed_slot: null,
    });

    // 2. Send chat message using service role
    const displayText = validSlots.map((s, i) => {
      let text = s.date;
      if (s.timeStart) text += ` ${s.timeStart.replace(/(AM|PM)/, ' $1')}`;
      if (s.timeEnd) text += ` – ${s.timeEnd.replace(/(AM|PM)/, ' $1')}`;
      return `Option ${i + 1}: ${text}`;
    }).join('\n');

    await base44.asServiceRole.entities.Message.create({
      room_id: roomId,
      sender_profile_id: profileId || null,
      body: `📅 Walk-through Requested\n\n${displayText}\n\nPlease confirm or suggest a different time.`,
      metadata: {
        type: 'walkthrough_request',
        walkthrough_slots: validSlots,
        status: 'pending'
      }
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[scheduleWalkthrough] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});