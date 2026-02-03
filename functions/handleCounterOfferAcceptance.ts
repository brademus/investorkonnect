import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const { event, data, old_data } = body;
    
    // Only process update events where status changes to accepted
    if (event?.type !== 'update' || !data || !old_data) {
      return Response.json({ success: true, message: 'No action needed' });
    }
    
    const counterOffer = data;
    const oldCounterOffer = old_data;
    
    // Check if status changed to accepted
    if (counterOffer.status !== 'accepted' || oldCounterOffer.status === 'accepted') {
      return Response.json({ success: true, message: 'Counter offer not newly accepted' });
    }
    
    const roomId = counterOffer.room_id;
    if (!roomId) {
      return Response.json({ error: 'No room_id found on counter offer' }, { status: 400 });
    }
    
    // Get the room
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    if (rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }
    
    const room = rooms[0];
    
    // Merge the counter offer terms with existing proposed terms - ONLY for this agent's room
    const updatedTerms = {
      ...(room.proposed_terms || {}),
      ...(counterOffer.terms_delta || {})
    };

    // Update ONLY this agent's room with new terms and flag for agreement regeneration
    // This keeps each agent's terms isolated - other agents' rooms are unaffected
    await base44.asServiceRole.entities.Room.update(roomId, {
      proposed_terms: updatedTerms,
      requires_regenerate: true
    });

    // Mark all OTHER pending counters for THIS ROOM as superseded
    // This ensures only one counter per agent is in flight at a time
    const pendingCounters = await base44.asServiceRole.entities.CounterOffer.filter({
      room_id: roomId,
      status: 'pending'
    });

    for (const pending of pendingCounters) {
      if (pending.id !== counterOffer.id) {
        await base44.asServiceRole.entities.CounterOffer.update(pending.id, {
          status: 'superseded',
          superseded_by_counter_offer_id: counterOffer.id
        });
      }
    }
    
    return Response.json({ 
      success: true, 
      message: `Room ${roomId} updated with new terms and flagged for regeneration. ${pendingCounters.length} pending counters superseded.` 
    });
    
  } catch (error) {
    console.error('Error handling counter offer acceptance:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});