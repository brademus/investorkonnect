import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Retroactively create invites for a deal that was signed but invites weren't created
 * User provides the agent IDs they want to invite
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const { deal_id, agent_ids } = body;
    
    if (!deal_id || !agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return Response.json({ error: 'deal_id and agent_ids array required' }, { status: 400 });
    }
    
    // Get investor profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Verify this is the investor's deal
    if (deal.investor_id !== profile.id) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    // Verify deal is signed
    const baseAgreements = await base44.entities.LegalAgreement.filter({ deal_id, room_id: null }, '-updated_date', 1);
    const baseAgreement = baseAgreements?.[0];
    if (!baseAgreement?.investor_signed_at) {
      return Response.json({ error: 'Deal must be signed by investor first' }, { status: 400 });
    }
    
    console.log('[retroactiveCreateInvites] Creating invites for', agent_ids.length, 'agents');
    
    // Get existing invites/rooms
    const existingInvites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id });
    const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    const existingInvitesByAgent = new Map(existingInvites.map(i => [i.agent_profile_id, i]));
    const existingRoomsByAgent = new Map(existingRooms.map(r => [r.agentId, r]));
    
    // Prepare exhibit_a
    const exhibit_a = {
      transaction_type: 'ASSIGNMENT',
      compensation_model: deal.proposed_terms?.seller_commission_type === 'percentage' ? 'COMMISSION_PCT' : 'FLAT_FEE',
      commission_percentage: deal.proposed_terms?.seller_commission_percentage || 3,
      flat_fee_amount: deal.proposed_terms?.seller_flat_fee || 5000,
      buyer_commission_type: deal.proposed_terms?.buyer_commission_type || 'percentage',
      buyer_commission_percentage: deal.proposed_terms?.buyer_commission_percentage || 3,
      buyer_flat_fee: deal.proposed_terms?.buyer_flat_fee || 5000,
      agreement_length_days: deal.proposed_terms?.agreement_length || 180,
      exclusive_agreement: true
    };
    
    const createdInvites = [];
    
    // Create invites for each agent
    for (const agentId of agent_ids) {
      try {
        // Skip if room + invite already exist
        const existingInvite = existingInvitesByAgent.get(agentId);
        const existingRoom = existingRoomsByAgent.get(agentId);
        if (existingInvite?.room_id && existingRoom?.id) {
          console.log('[retroactiveCreateInvites] Invite already exists for agent:', agentId);
          createdInvites.push(existingInvite.id);
          continue;
        }
        
        // Create or reuse room
        let room = existingRoom;
        if (!room) {
          room = await base44.asServiceRole.entities.Room.create({
            deal_id: deal_id,
            investorId: profile.id,
            agentId: agentId,
            request_status: 'requested',
            agreement_status: 'draft',
            title: deal.title,
            property_address: deal.property_address,
            city: deal.city,
            state: deal.state,
            county: deal.county,
            zip: deal.zip,
            budget: deal.purchase_price,
            closing_date: deal.key_dates?.closing_date,
            proposed_terms: deal.proposed_terms,
            requested_at: new Date().toISOString()
          });
          console.log('[retroactiveCreateInvites] Created room:', room.id);
        }
        
        // Generate or reuse agreement
        let agreement;
        if (existingInvite?.legal_agreement_id) {
          const existing = await base44.asServiceRole.entities.LegalAgreement.filter({ 
            id: existingInvite.legal_agreement_id 
          }).then(arr => arr[0]);
          if (existing) agreement = existing;
        }
        
        if (!agreement) {
          const genRes = await base44.functions.invoke('generateLegalAgreement', {
            deal_id: deal_id,
            room_id: room.id,
            exhibit_a
          });
          
          if (!genRes.data?.success) {
            throw new Error(genRes.data?.error || 'Failed to generate agreement');
          }
          
          agreement = genRes.data.agreement;
          console.log('[retroactiveCreateInvites] Generated agreement:', agreement.id);
        }
        
        // Update room with agreement
        if (!room.current_legal_agreement_id) {
          await base44.asServiceRole.entities.Room.update(room.id, {
            current_legal_agreement_id: agreement.id,
            agreement_status: 'sent'
          });
        }
        
        // Create invite
        let invite;
        if (existingInvite) {
          invite = existingInvite;
        } else {
          invite = await base44.asServiceRole.entities.DealInvite.create({
            deal_id: deal_id,
            investor_id: profile.id,
            agent_profile_id: agentId,
            room_id: room.id,
            legal_agreement_id: agreement.id,
            status: 'PENDING_AGENT_SIGNATURE',
            created_at_iso: new Date().toISOString()
          });
          console.log('[retroactiveCreateInvites] Created invite:', invite.id);
        }
        
        createdInvites.push(invite.id);
        
      } catch (error) {
        console.error('[retroactiveCreateInvites] Failed for agent', agentId, ':', error);
      }
    }
    
    if (createdInvites.length === 0) {
      return Response.json({ 
        error: 'No invites created',
        invite_ids: []
      }, { status: 400 });
    }
    
    // Update deal metadata to track selected agents
    await base44.asServiceRole.entities.Deal.update(deal_id, {
      status: 'active',
      metadata: {
        ...deal.metadata,
        selected_agent_ids: agent_ids,
        invites_created_at: new Date().toISOString()
      }
    });
    
    console.log('[retroactiveCreateInvites] Created', createdInvites.length, 'invites');
    
    return Response.json({ 
      ok: true, 
      invite_ids: createdInvites,
      message: `Created ${createdInvites.length} invite(s). Go back to Pipeline and refresh.`
    });
    
  } catch (error) {
    console.error('[retroactiveCreateInvites] Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});