import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Canonical State Transition Handler for Deal Requests
 * 
 * All room status changes go through this single function to ensure
 * consistent state transitions and prevent conflicting paths.
 * 
 * Actions:
 * - accept: Agent accepts deal request (requested → accepted)
 * - reject: Agent rejects deal request (requested → rejected)
 * - send_agreement: Investor sends agreement (accepted → agreement sent)
 * - investor_sign: Investor signs agreement
 * - agent_sign: Agent signs agreement
 * - finalize_signatures: Complete signing (→ fully_signed)
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

    // Get user's profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch room
    const rooms = await base44.entities.Room.filter({ id: roomId });
    const room = rooms[0];
    
    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify user has access to this room
    const isInvestor = room.investorId === profile.id;
    const isAgent = room.agentId === profile.id;

    // Fallback: some rooms may not have agentId set yet; check RoomParticipant linkage
    let isParticipant = false;
    let participantRole = null; // 'investor' | 'agent'
    try {
      const parts = await base44.entities.RoomParticipant.filter({ room_id: roomId, profile_id: profile.id });
      if (Array.isArray(parts) && parts[0]) {
        isParticipant = true;
        participantRole = parts[0].role || null;
      }
    } catch (_) {}

    if (!isInvestor && !isAgent && !isParticipant) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Effective permission helpers
    const agentAccess = isAgent || participantRole === 'agent' || profile.user_role === 'agent';

    // Handle state transitions
    let updates = {};
    let activityMessage = '';

    switch (action) {
      case 'accept':
        // Agent accepts deal request
        if (!agentAccess) {
          return Response.json({ 
            error: 'Only agents can accept requests' 
          }, { status: 403 });
        }
        
        if (room.request_status !== 'requested') {
          return Response.json({ 
            error: 'Deal not in requested state' 
          }, { status: 400 });
        }
        
        updates = {
          request_status: 'accepted',
          accepted_at: new Date().toISOString(),
          ...(room.agentId ? {} : { agentId: profile.id })
        };
        activityMessage = `${profile.full_name} accepted the deal request`;
        break;

      case 'reject':
        // Agent rejects deal request
        if (!agentAccess) {
          return Response.json({ 
            error: 'Only agents can reject requests' 
          }, { status: 403 });
        }
        
        updates = {
          request_status: 'rejected',
          rejected_at: new Date().toISOString()
        };
        activityMessage = `${profile.full_name} declined the deal request`;
        break;

      case 'send_agreement':
        // Send agreement for signing
        if (room.request_status !== 'accepted') {
          return Response.json({ 
            error: 'Deal must be accepted first' 
          }, { status: 400 });
        }
        
        updates = {
          agreement_status: 'sent'
        };
        activityMessage = 'Agreement sent for signature';
        break;

      case 'investor_sign':
        // Investor signs agreement
        if (!isInvestor) {
          return Response.json({ 
            error: 'Only investors can sign as investor' 
          }, { status: 403 });
        }
        
        if (room.agreement_status !== 'sent' && room.agreement_status !== 'agent_signed') {
          return Response.json({ 
            error: 'Agreement not ready for investor signature' 
          }, { status: 400 });
        }
        
        // Check if agent already signed
        if (room.agreement_status === 'agent_signed') {
          updates = {
            agreement_status: 'fully_signed',
            request_status: 'signed',
            signed_at: new Date().toISOString()
          };
          activityMessage = `${profile.full_name} completed signing - Agreement fully executed`;
        } else {
          updates = {
            agreement_status: 'investor_signed'
          };
          activityMessage = `${profile.full_name} signed the agreement`;
        }
        break;

      case 'agent_sign':
        // Agent signs agreement
        if (!isAgent) {
          return Response.json({ 
            error: 'Only agents can sign as agent' 
          }, { status: 403 });
        }
        
        if (room.agreement_status !== 'sent' && room.agreement_status !== 'investor_signed') {
          return Response.json({ 
            error: 'Agreement not ready for agent signature' 
          }, { status: 400 });
        }
        
        // Check if investor already signed
        if (room.agreement_status === 'investor_signed') {
          updates = {
            agreement_status: 'fully_signed',
            request_status: 'signed',
            signed_at: new Date().toISOString()
          };
          activityMessage = `${profile.full_name} completed signing - Agreement fully executed`;
        } else {
          updates = {
            agreement_status: 'agent_signed'
          };
          activityMessage = `${profile.full_name} signed the agreement`;
        }
        break;

      case 'finalize_signatures':
        // Final signature completing the agreement
        if (room.agreement_status !== 'investor_signed' && room.agreement_status !== 'agent_signed') {
          return Response.json({ 
            error: 'Both parties must sign first' 
          }, { status: 400 });
        }
        
        updates = {
          agreement_status: 'fully_signed',
          request_status: 'signed',
          signed_at: new Date().toISOString()
        };
        activityMessage = 'Agreement fully executed - All parties signed';
        break;

      default:
        return Response.json({ 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }

    // Apply updates
    await base44.entities.Room.update(roomId, updates);

    // Log activity if deal_id exists
    if (room.deal_id && activityMessage) {
      try {
        await base44.entities.Activity.create({
          type: action === 'accept' ? 'agent_accepted' : 
                action === 'reject' ? 'agent_rejected' : 
                'agreement_updated',
          deal_id: room.deal_id,
          room_id: roomId,
          actor_id: profile.id,
          actor_name: profile.full_name || profile.email,
          message: activityMessage
        });
      } catch (activityError) {
        // Activity logging is optional, don't fail the request
        console.error('Failed to log activity:', activityError);
      }
    }

    return Response.json({ 
      success: true,
      newStatus: updates.request_status || room.request_status,
      agreementStatus: updates.agreement_status || room.agreement_status
    });
  } catch (error) {
    console.error('transitionDealRequestStatus error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});