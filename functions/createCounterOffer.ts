import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deal_id, room_id, from_role, terms_delta } = await req.json();
    
    if (!deal_id || !from_role || !terms_delta) {
      return Response.json({ error: 'deal_id, from_role, and terms_delta required' }, { status: 400 });
    }
    
    console.log('[createCounterOffer] Mode:', room_id ? 'ROOM-SCOPED' : 'LEGACY');
    
    if (!['investor', 'agent'].includes(from_role)) {
      return Response.json({ error: 'from_role must be investor or agent' }, { status: 400 });
    }
    
    // Verify user has access to this deal
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Verify role matches
    if (profile.user_role !== from_role) {
      return Response.json({ error: 'Role mismatch' }, { status: 403 });
    }
    
    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Verify user is participant (room-scoped aware)
    if (from_role === 'investor') {
      if (deal.investor_id !== profile.id) {
        return Response.json({ error: 'Not authorized for this deal' }, { status: 403 });
      }
    } else if (from_role === 'agent') {
      if (room_id) {
        const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
        const rm = rooms?.[0];
        if (!rm || rm.agentId !== profile.id || rm.request_status === 'expired') {
          return Response.json({ error: 'Not authorized for this room' }, { status: 403 });
        }
      } else {
        // Legacy: allow if Deal.agent_id matches OR agent has an active room for this deal
        if (deal.agent_id !== profile.id) {
          const myRooms = await base44.asServiceRole.entities.Room.filter({ deal_id, agentId: profile.id });
          const hasActive = (myRooms || []).some(r => r.request_status !== 'expired');
          if (!hasActive) {
            return Response.json({ error: 'Not authorized for this deal' }, { status: 403 });
          }
        }
      }
    }
    
    // Supersede any existing pending counter (batch update for performance)
    const filterQuery = room_id 
      ? { room_id, status: 'pending' }
      : { deal_id, status: 'pending' };
    
    const existingPending = await base44.asServiceRole.entities.CounterOffer.filter(filterQuery);
    
    if (existingPending.length > 0) {
      await Promise.all(existingPending.map(existing =>
        base44.asServiceRole.entities.CounterOffer.update(existing.id, {
          status: 'superseded',
          responded_at: new Date().toISOString()
        })
      ));
      console.log('[createCounterOffer] Superseded', existingPending.length, 'pending offers');
    }
    
    // Create new counter offer with original terms snapshot
    const toRole = from_role === 'investor' ? 'agent' : 'investor';
    const originalTerms = deal.proposed_terms || {};
    
    const newCounter = await base44.asServiceRole.entities.CounterOffer.create({
      deal_id,
      room_id: room_id || null, // Room-scoped or legacy null
      from_role,
      to_role: toRole,
      status: 'pending',
      terms_delta,
      original_terms_snapshot: originalTerms
    });
    
    console.log('[createCounterOffer] ✓ Created new counter offer:', newCounter.id);
    
    return Response.json({
      success: true,
      counter_offer: newCounter,
      deal: deal
    });
    
  } catch (error) {
    console.error('[createCounterOffer] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});