import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Canonical state transition for deal requests
 * Enforces allowed transitions and updates both legacy and new status fields
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomId, action } = await req.json();
    
    if (!roomId || !action) {
      return Response.json({ 
        error: 'roomId and action required' 
      }, { status: 400 });
    }

    // Get user profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const userRole = profile.user_role || profile.role;

    // Get room
    const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId });
    const room = rooms[0];
    
    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    // Get current status
    const currentRequestStatus = room.request_status || 'requested';
    const currentAgreementStatus = room.agreement_status || 'draft';

    // Define allowed transitions
    const updates = {};
    let allowed = false;

    switch (action) {
      case 'accept':
        // Agent accepting investor's request
        if (userRole === 'agent' && currentRequestStatus === 'requested') {
          updates.request_status = 'accepted';
          updates.accepted_at = new Date().toISOString();
          allowed = true;
        }
        break;

      case 'reject':
        // Agent declining investor's request
        if (userRole === 'agent' && currentRequestStatus === 'requested') {
          updates.request_status = 'rejected';
          updates.rejected_at = new Date().toISOString();
          allowed = true;
        }
        break;

      case 'send_agreement':
        // Send agreement for signing (either party)
        if (currentRequestStatus === 'accepted' && currentAgreementStatus === 'draft') {
          updates.agreement_status = 'sent';
          allowed = true;
        }
        break;

      case 'investor_sign':
        // Investor signing agreement
        if (userRole === 'investor' && currentAgreementStatus === 'sent') {
          updates.agreement_status = 'investor_signed';
          allowed = true;
        }
        break;

      case 'agent_sign':
        // Agent signing agreement
        if (userRole === 'agent' && currentAgreementStatus === 'sent') {
          updates.agreement_status = 'agent_signed';
          allowed = true;
        }
        break;

      case 'finalize_signatures':
        // Both parties signed - finalize
        if (
          (userRole === 'investor' && currentAgreementStatus === 'agent_signed') ||
          (userRole === 'agent' && currentAgreementStatus === 'investor_signed')
        ) {
          updates.agreement_status = 'fully_signed';
          updates.request_status = 'signed'; // Update legacy field too
          updates.signed_at = new Date().toISOString();
          allowed = true;
        }
        break;

      default:
        return Response.json({ 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }

    if (!allowed) {
      return Response.json({ 
        error: `Transition not allowed: ${currentRequestStatus}/${currentAgreementStatus} -> ${action} by ${userRole}` 
      }, { status: 403 });
    }

    // Update room with new status
    await base44.asServiceRole.entities.Room.update(roomId, updates);

    // Log activity
    if (room.deal_id) {
      await base44.asServiceRole.entities.Activity.create({
        type: action === 'accept' ? 'agent_accepted' : 
              action === 'reject' ? 'agent_rejected' : 
              'deal_stage_changed',
        deal_id: room.deal_id,
        room_id: roomId,
        actor_id: profile.id,
        actor_name: profile.full_name || profile.email,
        message: `${profile.full_name || profile.email} performed action: ${action}`,
        metadata: { action, from: currentRequestStatus, to: updates.request_status || updates.agreement_status }
      }).catch(() => {}); // Silent fail - activity is nice-to-have
    }

    return Response.json({ 
      success: true,
      updates 
    });

  } catch (error) {
    console.error('transitionDealRequestStatus error:', error);
    return Response.json({ 
      error: error.message || 'Failed to transition status' 
    }, { status: 500 });
  }
});