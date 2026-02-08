import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get the active legal agreement for a deal/room.
 * Priority: room pointer > room-scoped > deal-level
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let deal_id, room_id;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      deal_id = url.searchParams.get('deal_id');
      room_id = url.searchParams.get('room_id');
    } else {
      const body = await req.json();
      deal_id = body.deal_id;
      room_id = body.room_id;
    }

    if (!deal_id) return Response.json({ error: 'deal_id required' }, { status: 400 });

    let agreement = null;

    // 1. Try room pointer first
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
      const room = rooms?.[0];
      if (room?.current_legal_agreement_id) {
        const arr = await base44.asServiceRole.entities.LegalAgreement.filter({ id: room.current_legal_agreement_id });
        if (arr?.[0]) agreement = arr[0];
      }
    }

    // 2. Fallback: search by room_id or deal_id
    if (!agreement) {
      let list = [];
      if (room_id) {
        list = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id, room_id }, '-created_date', 5);
        if (!list.length) list = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 5);
      } else {
        list = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 5);
      }
      // Pick the active one (not superseded/voided)
      agreement = list.find(a => !['superseded', 'voided'].includes(a.status)) || list[0] || null;
    }

    if (!agreement) return Response.json({ agreement: null });

    // Access check
    let hasAccess = agreement.investor_user_id === user.id || agreement.agent_user_id === user.id;
    if (!hasAccess) {
      const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
      const p = profiles?.[0];
      if (p) {
        const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
        if (deals?.[0]?.selected_agent_ids?.includes(p.id)) hasAccess = true;
        if (!hasAccess && room_id) {
          const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
          if (rooms?.[0]?.agent_ids?.includes(p.id)) hasAccess = true;
        }
      }
    }
    if (!hasAccess) return Response.json({ error: 'Not authorized' }, { status: 403 });

    return Response.json({ agreement });
  } catch (error) {
    console.error('[getLegalAgreement] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});