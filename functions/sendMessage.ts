import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send a chat message. Chat is enabled only after agreement is fully signed.
 */
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

    // Get room
    let room = null;
    try { room = await base44.asServiceRole.entities.Room.get(room_id); } catch (_) {}
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });

    // Access check
    const isParticipant = room.investorId === profile.id || room.agent_ids?.includes(profile.id) || room.agentId === profile.id;
    if (!isParticipant) return Response.json({ error: 'Access denied' }, { status: 403 });

    // Chat gating: only after fully signed
    let canChat = room.agreement_status === 'fully_signed' || room.request_status === 'signed';
    if (!canChat && room.deal_id) {
      const ags = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: room.deal_id });
      canChat = ags?.some(a => a.status === 'fully_signed');
    }
    if (!canChat) return Response.json({ error: 'Chat unlocks after both parties sign.', ok: false }, { status: 403 });

    const message = await base44.asServiceRole.entities.Message.create({
      room_id, sender_profile_id: profile.id, body: text
    });

    return Response.json({ ok: true, message });
  } catch (error) {
    console.error('[sendMessage] Error:', error);
    const status = error?.status || 500;
    return Response.json({ error: error.message, ok: false }, { status });
  }
});