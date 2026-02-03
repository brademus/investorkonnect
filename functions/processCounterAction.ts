import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * UNIFIED COUNTER OFFER HANDLER - Replaces createCounterOffer + respondToCounterOffer
 * Handles: create, accept, decline, recounter
 * ALL operations are room-scoped (no legacy paths)
 */

async function withRetry(fn, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500;
        console.log(`[processCounterAction] Rate limited (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`);
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
    
    const { action, room_id, counter_offer_id, terms_delta } = await req.json();
    
    if (!action || !room_id) {
      return Response.json({ error: 'action and room_id required' }, { status: 400 });
    }
    
    if (!['create', 'accept', 'decline', 'recounter'].includes(action)) {
      return Response.json({ error: 'Invalid action: create, accept, decline, or recounter' }, { status: 400 });
    }
    
    console.log('[processCounterAction] Action:', action, 'Room:', room_id);
    
    // PARALLEL FETCH: Load user profile + room + deal together
    const [userProfile, room, deal] = await Promise.all([
      withRetry(async () => {
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        if (!profiles?.length) throw new Error('Profile not found for user');
        return profiles[0];
      }),
      withRetry(async () => {
        const rooms = await base44.asServiceRole.entities.Room.filter({ id: room_id });
        if (!rooms?.length) throw new Error('Room not found');
        return rooms[0];
      }),
      // Deal loaded for reference but terms stored in room only
      null // We'll load deal if needed
    ]);
    
    const userRole = userProfile.user_role;
    
    // Verify authorization
    if (userRole === 'agent') {
      if (room.agentId !== userProfile.id || room.request_status === 'expired') {
        return Response.json({ error: 'Not authorized for this room' }, { status: 403 });
      }
    } else if (userRole === 'investor') {
      if (room.investorId !== userProfile.id) {
        return Response.json({ error: 'Not authorized for this room' }, { status: 403 });
      }
    } else {
      return Response.json({ error: 'Invalid user role' }, { status: 403 });
    }
    
    const now = new Date().toISOString();
    
    // ============ CREATE COUNTER ============
    if (action === 'create') {
      if (!terms_delta) {
        return Response.json({ error: 'terms_delta required for create action' }, { status: 400 });
      }
      
      console.log('[processCounterAction] Creating counter from', userRole, 'to', userRole === 'investor' ? 'agent' : 'investor');
      
      // Supersede any existing pending counters in this room
      const existingPending = await base44.asServiceRole.entities.CounterOffer.filter({
        room_id,
        status: 'pending'
      });
      
      if (existingPending.length > 0) {
        await Promise.all(existingPending.map(existing =>
          base44.asServiceRole.entities.CounterOffer.update(existing.id, {
            status: 'superseded',
            responded_at: now
          })
        ));
        console.log('[processCounterAction] Superseded', existingPending.length, 'pending offers');
      }
      
      // CRITICAL: Use room.proposed_terms as baseline (single source of truth)
      const originalTerms = room.proposed_terms || {};
      const toRole = userRole === 'investor' ? 'agent' : 'investor';
      
      const newCounter = await base44.asServiceRole.entities.CounterOffer.create({
        deal_id: room.deal_id,
        room_id: room_id,
        from_role: userRole,
        to_role: toRole,
        status: 'pending',
        terms_delta,
        original_terms_snapshot: originalTerms
      });
      
      console.log('[processCounterAction] ✓ Counter created:', newCounter.id);
      
      return Response.json({
        success: true,
        action: 'created',
        counter_offer_id: newCounter.id
      });
    }
    
    // ============ ACCEPT / DECLINE / RECOUNTER ============
    if (['accept', 'decline', 'recounter'].includes(action)) {
      if (!counter_offer_id) {
        return Response.json({ error: 'counter_offer_id required for this action' }, { status: 400 });
      }
      
      // Load counter offer
      const counter = await withRetry(async () => {
        const counters = await base44.asServiceRole.entities.CounterOffer.filter({ id: counter_offer_id });
        if (!counters?.length) throw new Error('Counter offer not found');
        return counters[0];
      });
      
      if (counter.status !== 'pending') {
        return Response.json({ 
          error: `Counter is already ${counter.status}. Cannot respond to non-pending counters.` 
        }, { status: 400 });
      }
      
      if (counter.room_id !== room_id) {
        return Response.json({ error: 'Counter offer does not belong to this room' }, { status: 400 });
      }
      
      if (userRole !== counter.to_role) {
        return Response.json({ 
          error: `Only the ${counter.to_role} can respond to this counter` 
        }, { status: 403 });
      }
      
      // -------- DECLINE --------
      if (action === 'decline') {
        console.log('[processCounterAction] Processing DECLINE');
        
        await withRetry(async () => {
          await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
            status: 'declined',
            responded_at: now,
            responded_by_role: userRole
          });
        });
        
        // Clear requires_regenerate if it was set
        if (room.requires_regenerate) {
          await base44.asServiceRole.entities.Room.update(room_id, {
            requires_regenerate: false
          });
        }
        
        console.log('[processCounterAction] ✓ Counter declined');
        return Response.json({ success: true, action: 'declined' });
      }
      
      // -------- RECOUNTER --------
      if (action === 'recounter') {
        console.log('[processCounterAction] Processing RECOUNTER');
        
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
        
        // Create new counter with flipped roles
        const newCounter = await withRetry(async () => {
          return await base44.asServiceRole.entities.CounterOffer.create({
            deal_id: room.deal_id,
            room_id: room_id,
            from_role: userRole,
            to_role: counter.from_role,
            status: 'pending',
            terms_delta: terms_delta,
            original_terms_snapshot: room.proposed_terms || {}
          });
        });
        
        // Update superseded pointer
        await withRetry(async () => {
          await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
            superseded_by_counter_offer_id: newCounter.id
          });
        });
        
        console.log('[processCounterAction] ✓ Recounter created:', newCounter.id);
        return Response.json({ 
          success: true, 
          action: 'recountered', 
          counter_offer_id: newCounter.id 
        });
      }
      
      // -------- ACCEPT --------
      if (action === 'accept') {
        console.log('[processCounterAction] Processing ACCEPT');

        const acceptedTerms = counter.terms_delta || {};

        // Mark counter as accepted
        await withRetry(async () => {
          await base44.asServiceRole.entities.CounterOffer.update(counter_offer_id, {
            status: 'accepted',
            responded_at: now,
            responded_by_role: userRole
          });
        });

        // Supersede ALL other pending counters in THIS room only
        const allCounters = await withRetry(async () => {
          return await base44.asServiceRole.entities.CounterOffer.filter({
            room_id: room_id,
            status: 'pending'
          });
        });

        const otherPendingCounters = (allCounters || []).filter(c => c.id !== counter_offer_id);
        if (otherPendingCounters.length > 0) {
          for (let i = 0; i < otherPendingCounters.length; i++) {
            const otherCounter = otherPendingCounters[i];
            await withRetry(async () => {
              await base44.asServiceRole.entities.CounterOffer.update(otherCounter.id, {
                status: 'superseded',
                superseded_by_counter_offer_id: counter_offer_id
              });
            });
            if (i < otherPendingCounters.length - 1) {
              await new Promise(r => setTimeout(r, 100));
            }
          }
        }
        console.log('[processCounterAction] ✓ Marked', otherPendingCounters.length, 'other pending counters as superseded');

        // CRITICAL: Update THIS room's terms only (single source of truth)
        const baseTerms = room.proposed_terms || {};
        const mergedTerms = { ...baseTerms, ...acceptedTerms };
        
        // PARALLEL: Update room + mark old agreement superseded
        const updates = [
          base44.asServiceRole.entities.Room.update(room_id, {
            proposed_terms: mergedTerms,
            requires_regenerate: true,
            agreement_status: 'draft'
          })
        ];
        
        if (room.current_legal_agreement_id) {
          updates.push(
            base44.asServiceRole.entities.LegalAgreement.update(room.current_legal_agreement_id, {
              status: 'superseded'
            }).catch(e => console.warn('[processCounterAction] Failed to mark agreement superseded:', e?.message))
          );
        }
        
        await Promise.all(updates);
        console.log('[processCounterAction] ✓ Updated room', room_id, 'terms (isolated)');

        return Response.json({ 
          success: true, 
          action: 'accepted',
          accepted_terms: mergedTerms
        });
      }
    }
    
    return Response.json({ error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    console.error('[processCounterAction] Fatal error:', error);
    return Response.json({ 
      error: error?.message || 'Failed to process counter action' 
    }, { status: 500 });
  }
});