import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PHASE 7: Backfill Multi-Agent Pointers
 * 
 * Safely populates locked_room_id, Room.current_legal_agreement_id, and CounterOffer.room_id
 * for existing deals created before Phase 1-6 implementation.
 * 
 * IDEMPOTENT: Safe to run multiple times - only updates missing/null values.
 * 
 * Run manually via: POST /functions/backfillMultiAgentPointers
 * Admin-only endpoint.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADMIN-ONLY: Verify user is admin
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile || (profile.role !== 'admin' && profile.user_role !== 'admin')) {
      return Response.json({ 
        error: 'Forbidden: Admin access required' 
      }, { status: 403 });
    }

    console.log('[Backfill] Starting multi-agent pointer backfill...');
    console.log('[Backfill] Running as:', user.email);

    const stats = {
      deals_locked_room_id_set: 0,
      deals_locked_agent_id_set: 0,
      rooms_current_agreement_set: 0,
      agreements_room_id_set: 0,
      counters_room_id_set: 0,
      counters_terms_normalized: 0
    };

    // STEP 1: Set Deal.locked_room_id and locked_agent_id for deals with agent_id but no lock
    console.log('[Backfill] STEP 1: Populating Deal.locked_room_id and locked_agent_id...');
    
    const allDeals = await base44.asServiceRole.entities.Deal.list();
    
    for (const deal of allDeals) {
      if (!deal.agent_id) continue;
      
      // Only backfill if locked_room_id is missing
      if (deal.locked_room_id) continue;
      
      try {
        // Find the room for this deal where room.agentId == deal.agent_id
        const rooms = await base44.asServiceRole.entities.Room.filter({ 
          deal_id: deal.id,
          agentId: deal.agent_id
        });
        
        if (rooms.length === 0) {
          console.log(`[Backfill] Deal ${deal.id}: No room found for agent ${deal.agent_id}`);
          continue;
        }
        
        const room = rooms[0];
        
        await base44.asServiceRole.entities.Deal.update(deal.id, {
          locked_room_id: room.id,
          locked_agent_id: deal.agent_id,
          connected_at: deal.connected_at || new Date().toISOString()
        });
        
        stats.deals_locked_room_id_set++;
        if (!deal.locked_agent_id) stats.deals_locked_agent_id_set++;
        
        console.log(`[Backfill] ✓ Deal ${deal.id}: Set locked_room_id=${room.id}`);
      } catch (error) {
        console.error(`[Backfill] Failed to update deal ${deal.id}:`, error.message);
      }
    }

    // STEP 2: Set Room.current_legal_agreement_id for locked deals
    console.log('[Backfill] STEP 2: Populating Room.current_legal_agreement_id...');
    
    const lockedDeals = await base44.asServiceRole.entities.Deal.filter({ 
      locked_room_id: { $ne: null } 
    });
    
    for (const deal of lockedDeals) {
      try {
        const rooms = await base44.asServiceRole.entities.Room.filter({ id: deal.locked_room_id });
        if (rooms.length === 0) continue;
        
        const room = rooms[0];
        
        // Only update if current_legal_agreement_id is missing
        if (room.current_legal_agreement_id) continue;
        
        // Find latest non-superseded LegalAgreement for this deal
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
          deal_id: deal.id 
        }, '-created_date', 10);
        
        let agreement = null;
        
        // Prefer agreement with matching room_id
        const roomScoped = agreements.find(a => 
          a.room_id === room.id && 
          a.status !== 'superseded' && 
          a.status !== 'voided'
        );
        
        if (roomScoped) {
          agreement = roomScoped;
        } else {
          // Fallback: latest non-superseded for this deal
          agreement = agreements.find(a => 
            a.status !== 'superseded' && 
            a.status !== 'voided'
          ) || agreements[0];
        }
        
        if (!agreement) {
          console.log(`[Backfill] Room ${room.id}: No agreement found for deal ${deal.id}`);
          continue;
        }
        
        await base44.asServiceRole.entities.Room.update(room.id, {
          current_legal_agreement_id: agreement.id
        });
        
        stats.rooms_current_agreement_set++;
        
        console.log(`[Backfill] ✓ Room ${room.id}: Set current_legal_agreement_id=${agreement.id}`);
        
        // STEP 2b: Set agreement.room_id if missing
        if (!agreement.room_id) {
          await base44.asServiceRole.entities.LegalAgreement.update(agreement.id, {
            room_id: room.id
          });
          stats.agreements_room_id_set++;
          console.log(`[Backfill] ✓ Agreement ${agreement.id}: Set room_id=${room.id}`);
        }
      } catch (error) {
        console.error(`[Backfill] Failed to update room for deal ${deal.id}:`, error.message);
      }
    }

    // STEP 3: Set CounterOffer.room_id for counters missing it
    console.log('[Backfill] STEP 3: Populating CounterOffer.room_id...');
    
    const allCounters = await base44.asServiceRole.entities.CounterOffer.list();
    
    for (const counter of allCounters) {
      if (!counter.deal_id) continue;
      
      try {
        let updates = {};
        
        // Infer room_id if missing
        if (!counter.room_id) {
          const deals = await base44.asServiceRole.entities.Deal.filter({ id: counter.deal_id });
          const deal = deals[0];
          
          if (deal?.locked_room_id) {
            updates.room_id = deal.locked_room_id;
            stats.counters_room_id_set++;
          } else {
            // Fallback: use the only room if there's only one
            const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: counter.deal_id });
            if (rooms.length === 1) {
              updates.room_id = rooms[0].id;
              stats.counters_room_id_set++;
            }
          }
        }
        
        // Normalize terms field: if terms_delta null and terms exists, copy it
        if (!counter.terms_delta && counter.terms) {
          updates.terms_delta = counter.terms;
          stats.counters_terms_normalized++;
        }
        
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.CounterOffer.update(counter.id, updates);
          console.log(`[Backfill] ✓ Counter ${counter.id}: Updated`, Object.keys(updates));
        }
      } catch (error) {
        console.error(`[Backfill] Failed to update counter ${counter.id}:`, error.message);
      }
    }

    console.log('[Backfill] Complete!');
    console.log('[Backfill] Stats:', stats);

    return Response.json({
      success: true,
      message: 'Backfill completed successfully',
      stats
    });
    
  } catch (error) {
    console.error('[Backfill] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});