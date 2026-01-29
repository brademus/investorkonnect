import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * When an agent signs an agreement, void all other pending agreements for the same deal
 * and lock the deal to this agent only
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { agreement_id } = body;
    
    if (!agreement_id) {
      return Response.json({ error: 'agreement_id required' }, { status: 400 });
    }
    
    // Get the signed agreement
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ id: agreement_id });
    if (!agreements || agreements.length === 0) {
      return Response.json({ error: 'Agreement not found' }, { status: 404 });
    }
    
    const signedAgreement = agreements[0];
    
    // Only proceed if both parties have signed
    if (!signedAgreement.investor_signed_at || !signedAgreement.agent_signed_at) {
      return Response.json({ 
        success: true, 
        message: 'Waiting for both signatures' 
      });
    }
    
    const dealId = signedAgreement.deal_id;
    const winningRoomId = signedAgreement.room_id;
    const winningAgentId = signedAgreement.agent_profile_id;
    
    console.log('[voidOtherAgentAgreements] Fully signed agreement detected');
    console.log('  Deal ID:', dealId);
    console.log('  Winning Room ID:', winningRoomId);
    console.log('  Winning Agent ID:', winningAgentId);
    
    // Lock the deal to this agent
    await base44.asServiceRole.entities.Deal.update(dealId, {
      locked_room_id: winningRoomId,
      locked_agent_id: winningAgentId,
      connected_at: new Date().toISOString(),
      agent_id: winningAgentId
    });
    
    // Mark winning room as locked
    if (winningRoomId) {
      await base44.asServiceRole.entities.Room.update(winningRoomId, {
        request_status: 'signed',
        agreement_status: 'fully_signed',
        signed_at: new Date().toISOString(),
        is_fully_signed: true
      });
    }
    
    // Find all other rooms for this deal
    const allRooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
    const otherRooms = allRooms.filter(r => r.id !== winningRoomId);
    
    console.log(`[voidOtherAgentAgreements] Found ${otherRooms.length} other rooms to expire`);
    
    // Void all other agreements and expire rooms
    for (const room of otherRooms) {
      // Update room status to expired
      await base44.asServiceRole.entities.Room.update(room.id, {
        request_status: 'expired',
        agreement_status: 'voided'
      });
      
      // Void associated agreement if exists
      if (room.current_legal_agreement_id) {
        try {
          await base44.asServiceRole.entities.LegalAgreement.update(room.current_legal_agreement_id, {
            status: 'voided',
            docusign_status: 'voided'
          });
        } catch (e) {
          console.warn('Failed to void agreement:', room.current_legal_agreement_id, e);
        }
      }
      
      // Find and void any other agreements for this room
      const roomAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
        room_id: room.id 
      });
      
      for (const ag of roomAgreements) {
        if (ag.id !== room.current_legal_agreement_id && ag.status !== 'voided') {
          try {
            await base44.asServiceRole.entities.LegalAgreement.update(ag.id, {
              status: 'voided',
              docusign_status: 'voided'
            });
          } catch (e) {
            console.warn('Failed to void agreement:', ag.id, e);
          }
        }
      }
    }
    
    console.log(`[voidOtherAgentAgreements] ✓ Voided ${otherRooms.length} other rooms and their agreements`);
    
    // Create activity log
    try {
      await base44.asServiceRole.entities.Activity.create({
        type: 'agent_locked_in',
        deal_id: dealId,
        room_id: winningRoomId,
        actor_id: winningAgentId,
        actor_name: signedAgreement.agent_user_id,
        message: 'Agent locked in - other pending agreements voided'
      });
    } catch (e) {
      // Activity is nice-to-have
    }
    
    return Response.json({ 
      success: true, 
      voided_count: otherRooms.length,
      locked_to_agent: winningAgentId
    });
    
  } catch (error) {
    console.error('[voidOtherAgentAgreements] Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});