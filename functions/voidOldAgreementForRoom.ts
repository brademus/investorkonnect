import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * When an agent signs a regenerated agreement, void ONLY the old agreement in THIS room.
 * Does NOT affect other rooms or other agents.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { room_id, new_agreement_id } = await req.json();
    
    if (!room_id || !new_agreement_id) {
      return Response.json({ error: 'room_id and new_agreement_id required' }, { status: 400 });
    }

    const room = await base44.asServiceRole.entities.Room.filter({ id: room_id });
    if (!room?.length) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get all agreements for this room
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
      room_id 
    });

    // Void all OLD agreements (not the new one we just signed)
    for (const ag of agreements) {
      if (ag.id !== new_agreement_id && ag.status !== 'voided') {
        await base44.asServiceRole.entities.LegalAgreement.update(ag.id, {
          status: 'voided',
          docusign_status: 'voided'
        });
        console.log('[voidOldAgreementForRoom] Voided old agreement:', ag.id);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[voidOldAgreementForRoom]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});