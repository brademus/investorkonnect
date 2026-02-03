import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * FIRST-TO-SIGN-WINS: Handle agent signature on base agreement
 * Locks deal to winning agent, voids all other competing base agreements
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { agreement_id } = await req.json();
    
    if (!agreement_id) {
      return Response.json({ error: 'agreement_id required' }, { status: 400 });
    }
    
    console.log('[handleAgentSignature] Processing signature for agreement:', agreement_id);
    
    // Get agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    if (!agreements?.length) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    const agreement = agreements[0];
    
    // Only process base agreements (shared by multiple agents)
    if (!agreement.room_id || agreement.signer_mode !== 'investor_only') {
      console.log('[handleAgentSignature] Not a base agreement, skipping lock-in');
      return Response.json({ success: true, locked: false });
    }
    
    // Get deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: agreement.deal_id });
    if (!deals?.length) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Check if already locked
    if (deal.locked_room_id) {
      console.log('[handleAgentSignature] Deal already locked to room:', deal.locked_room_id);
      return Response.json({ success: true, locked: true, already_locked: true });
    }
    
    // Lock the deal
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Deal.update(agreement.deal_id, {
      locked_room_id: agreement.room_id,
      locked_agent_id: agreement.agent_profile_id,
      agent_id: agreement.agent_profile_id,
      connected_at: now
    });
    console.log('[handleAgentSignature] ✓ Deal locked to room:', agreement.room_id);
    
    // Mark winning room as locked
    await base44.asServiceRole.entities.Room.update(agreement.room_id, {
      request_status: 'locked',
      signed_at: now
    });
    
    // Get all rooms for this deal
    const allRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: agreement.deal_id });
    const losingRooms = allRooms.filter(r => r.id !== agreement.room_id);
    
    console.log('[handleAgentSignature] Found', losingRooms.length, 'losing rooms to expire');
    
    // Void competing base agreements and expire losing rooms
    for (const losingRoom of losingRooms) {
      // Expire the room
      await base44.asServiceRole.entities.Room.update(losingRoom.id, {
        request_status: 'expired'
      });
      
      // Void the agreement if it's still a base agreement (not counter-regenerated)
      if (losingRoom.current_legal_agreement_id) {
        const losingAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({
          id: losingRoom.current_legal_agreement_id
        });
        
        if (losingAgreements?.length > 0) {
          const losingAgreement = losingAgreements[0];
          
          // Only void if it's the same base agreement (same terms, not counter)
          if (losingAgreement.signer_mode === 'investor_only' && 
              losingAgreement.docusign_envelope_id &&
              losingAgreement.status !== 'voided') {
            
            await base44.asServiceRole.entities.LegalAgreement.update(losingAgreement.id, {
              status: 'voided'
            });
            
            console.log('[handleAgentSignature] ✓ Voided agreement for losing room:', losingRoom.id);
          }
        }
      }
    }
    
    console.log('[handleAgentSignature] ✓ Lock-in complete. Deal locked, competing agreements voided');
    
    return Response.json({ 
      success: true, 
      locked: true,
      locked_room_id: agreement.room_id,
      expired_rooms: losingRooms.length
    });
    
  } catch (error) {
    console.error('[handleAgentSignature] Error:', error);
    return Response.json({ 
      error: error?.message || 'Failed to handle agent signature' 
    }, { status: 500 });
  }
});