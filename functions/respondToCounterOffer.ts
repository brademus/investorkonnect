import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function withRetry(fn, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500; // exponential: 1s, 2s, 4s, 8s, 16s
        console.log(`[respondToCounterOffer] Rate limited (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { counter_offer_id, action, terms_delta } = await req.json();
    console.log('[respondToCounterOffer] Request:', { counter_offer_id, action, user_id: user.id });
    
    if (!counter_offer_id || !action) {
      return Response.json({ error: 'counter_offer_id and action required' }, { status: 400 });
    }
    
    if (!['accept', 'decline', 'recounter'].includes(action)) {
      return Response.json({ error: 'Invalid action: accept, decline, or recounter' }, { status: 400 });
    }
    
    // Load the counter offer
    const counter = await withRetry(async () => {
      const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_offer_id });
      if (!counters?.length) throw new Error('Counter offer not found');
      return counters[0];
    });
    
    const room_id = counter.room_id || null;
    console.log('[respondToCounterOffer] Counter loaded:', { 
      id: counter.id, 
      status: counter.status, 
      from_role: counter.from_role, 
      to_role: counter.to_role,
      room_id: room_id || 'legacy'
    });
    
    if (counter.status !== 'pending') {
      return Response.json({ 
        error: `Counter is already ${counter.status}. Cannot respond to non-pending counters.` 
      }, { status: 400 });
    }
    
    // Verify user is the recipient
    const userProfile = await withRetry(async () => {
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (!profiles?.length) throw new Error('Profile not found for user');
      return profiles[0];
    });
    
    const userRole = userProfile.user_role;
    console.log('[respondToCounterOffer] User role:', userRole, 'Counter recipient:', counter.to_role);
    
    if (userRole !== counter.to_role) {
      return Response.json({ 
        error: `Only the ${counter.to_role} can respond to this counter` 
      }, { status: 403 });
    }
    
    const now = new Date().toISOString();
    
    // Load deal for context
    const deal = await withRetry(async () => {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
      if (!deals?.length) throw new Error('Deal not found');
      return deals[0];
    });

    // Room-scoped/legacy authorization after loading deal
    if (counter.room_id) {
      const rooms = await withRetry(async () => {
        const rs = await base44.asServiceRole.entities.Room.filter({ id: counter.room_id });
        if (!rs?.length) throw new Error('Room not found for counter');
        return rs;
      });
      const rm = rooms[0];
      if (userRole === 'agent') {
        if (rm.agentId !== userProfile.id || rm.request_status === 'expired') {
          return Response.json({ error: 'Not authorized for this room' }, { status: 403 });
        }
      } else {
        if (rm.investorId !== userProfile.id) {
          return Response.json({ error: 'Not authorized for this room' }, { status: 403 });
        }
      }
    } else {
      // Legacy: ensure participation via Deal or Room
      if (userRole === 'agent') {
        if (deal.agent_id !== userProfile.id) {
          const myRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: counter.deal_id, agentId: userProfile.id });
          const hasActive = (myRooms || []).some(r => r.request_status !== 'expired');
          if (!hasActive) {
            return Response.json({ error: 'Not authorized for this deal' }, { status: 403 });
          }
        }
      } else {
        if (deal.investor_id !== userProfile.id) {
          return Response.json({ error: 'Not authorized for this deal' }, { status: 403 });
        }
      }
    }
    
    // DECLINE
    if (action === 'decline') {
      console.log('[respondToCounterOffer] Processing DECLINE');
      
      await withRetry(async () => {
        await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
          status: 'declined',
          responded_at: now,
          responded_by_role: userRole
        });
      });
      
      // CRITICAL: Clear requires_regenerate if it was set (user declined the counter)
      if (room_id) {
        const room = (await base44.asServiceRole.entities.Room.filter({ id: room_id }))[0];
        if (room?.requires_regenerate) {
          await base44.asServiceRole.entities.Room.update(room_id, {
            requires_regenerate: false
          });
        }
      }
      
      console.log('[respondToCounterOffer] ✓ Counter declined');
      return Response.json({ success: true, action: 'declined' });
    }
    
    // RECOUNTER
    if (action === 'recounter') {
      console.log('[respondToCounterOffer] Processing RECOUNTER');
      
      if (!terms_delta) {
        return Response.json({ error: 'terms_delta required for recounter action' }, { status: 400 });
      }
      
      // Mark old counter as superseded
      await withRetry(async () => {
        await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
          status: 'superseded',
          responded_at: now,
          responded_by_role: userRole,
          superseded_by_counter_offer_id: 'pending_creation'
        });
      });
      
      console.log('[respondToCounterOffer] Old counter marked superseded');
      
      // Create new counter with flipped roles (room-scoped or legacy)
      const newCounter = await withRetry(async () => {
        return await base44.asServiceRole.entities.CounterOffer.create({
          deal_id: counter.deal_id,
          room_id: room_id || null, // Preserve room-scoped or legacy
          from_role: userRole,
          to_role: counter.from_role,
          status: 'pending',
          terms_delta: terms_delta,
          original_terms_snapshot: deal.proposed_terms || {}
        });
      });
      
      // Update superseded pointer
      await withRetry(async () => {
        await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
          superseded_by_counter_offer_id: newCounter.id
        });
      });
      
      console.log('[respondToCounterOffer] ✓ New counter created:', newCounter.id);
      return Response.json({ 
        success: true, 
        action: 'recountered', 
        counter_offer_id: newCounter.id 
      });
    }
    
    // ACCEPT
    if (action === 'accept') {
      console.log('[respondToCounterOffer] Processing ACCEPT');

      const acceptedTerms = counter.terms_delta || {};

      // Mark counter as accepted
      await withRetry(async () => {
        await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
          status: 'accepted',
          responded_at: now,
          responded_by_role: userRole
        });
      });

      console.log('[respondToCounterOffer] Counter marked accepted');

      // CRITICAL: Mark ALL other pending counters ONLY in THIS SPECIFIC ROOM as superseded
      // This prevents multiple conflicting accepted states within the same room
      const allCounters = await withRetry(async () => {
        if (room_id) {
          // Room-scoped: only get counters for THIS specific room
          return await base44.asServiceRole.entities.CounterOffer.filter({
            room_id: room_id,
            status: 'pending'
          });
        } else {
          // Legacy deal-scoped
          return await base44.asServiceRole.entities.CounterOffer.filter({
            deal_id: counter.deal_id,
            room_id: null,
            status: 'pending'
          });
        }
      });

      const otherPendingCounters = (allCounters || []).filter(c => c.id !== counter_offer_id);
      if (otherPendingCounters.length > 0) {
        // Batch supersede operations with throttling
        for (let i = 0; i < otherPendingCounters.length; i++) {
          const otherCounter = otherPendingCounters[i];
          await withRetry(async () => {
            await base44.asServiceRole.entities.CounterOffer.update(otherCounter.id, {
              status: 'superseded',
              superseded_by_counter_offer_id: counter_offer_id
            });
          });
          // Small delay between updates to avoid rate limiting
          if (i < otherPendingCounters.length - 1) {
            await new Promise(r => setTimeout(r, 100));
          }
        }
      }
      console.log('[respondToCounterOffer] ✓ Marked', otherPendingCounters.length, 'other pending counters as superseded');

      // Merge accepted terms with existing room/deal terms
      const baseTerms = room_id 
        ? ((await base44.asServiceRole.entities.Room.filter({ id: room_id }))[0]?.proposed_terms || {})
        : (deal.proposed_terms || {});
      
      const mergedTerms = { ...baseTerms, ...acceptedTerms };
      
      // Set regeneration flag (room-scoped or legacy) - only update the specific room/deal pair
      const updates = [];
      if (room_id) {
        // Room-scoped: update only this room's terms
        updates.push(
          base44.asServiceRole.entities.Room.update(room_id, {
            proposed_terms: mergedTerms,
            requires_regenerate: true,
            agreement_status: 'draft' // Reset to draft to trigger regeneration
          })
        );
        
        // CRITICAL: Mark old agreement as superseded
        const room = (await base44.asServiceRole.entities.Room.filter({ id: room_id }))[0];
        if (room?.current_legal_agreement_id) {
          try {
            await base44.asServiceRole.entities.LegalAgreement.update(room.current_legal_agreement_id, {
              status: 'superseded'
            });
            console.log('[respondToCounterOffer] ✓ Marked old agreement as superseded');
          } catch (e) {
            console.warn('[respondToCounterOffer] Failed to mark agreement superseded:', e?.message);
          }
        }
      } else {
        // Legacy: update deal level
        updates.push(
          base44.asServiceRole.entities.Deal.update(counter.deal_id, {
            proposed_terms: mergedTerms,
            requires_regenerate: true,
            requires_regenerate_reason: `${userRole} accepted counter at ${now}`
          })
        );
      }

      await Promise.all(updates);
      console.log('[respondToCounterOffer] ✓ Terms and regenerate flags updated');

      return Response.json({ 
        success: true, 
        action: 'accepted',
        accepted_terms: mergedTerms
      });
    }
    
    return Response.json({ error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    console.error('[respondToCounterOffer] Fatal error:', error);
    return Response.json({ 
      error: error?.message || 'Failed to respond to counter offer' 
    }, { status: 500 });
  }
});