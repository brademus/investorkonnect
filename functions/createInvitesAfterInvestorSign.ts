import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * After investor signs initial agreement, create one DealInvite per selected agent
 * Creates rooms, agent-specific agreements, and invite records
 * IDEMPOTENT: safe to call multiple times (won't duplicate invites)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const { deal_id } = body;
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
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
    
    // Get selected agent IDs
    const selectedAgentIds = deal.metadata?.selected_agent_ids || [];
    console.log('[createInvitesAfterInvestorSign] Deal metadata:', deal.metadata);
    console.log('[createInvitesAfterInvestorSign] Selected agent IDs:', selectedAgentIds);
    
    if (selectedAgentIds.length === 0) {
      console.error('[createInvitesAfterInvestorSign] No agents selected for deal:', deal_id);
      return Response.json({ error: 'No agents selected for this deal' }, { status: 400 });
    }
    
    console.log('[createInvitesAfterInvestorSign] Creating invites for', selectedAgentIds.length, 'agents');
    
    // Get existing invites and rooms map by agent for true idempotency
    const existingInvites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id });
    const existingRooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    const existingInvitesByAgent = new Map(existingInvites.map(i => [i.agent_profile_id, i]));
    const existingRoomsByAgent = new Map(existingRooms.map(r => [r.agentId, r]));
    
    // Prepare exhibit_a for agreements
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

    // Create invite for each agent (true idempotency: skip if room + agreement + invite all exist)
    for (const agentId of selectedAgentIds) {
     try {
       // Skip if room + legal agreement + invite already exist for this agent
       const existingInvite = existingInvitesByAgent.get(agentId);
       const existingRoom = existingRoomsByAgent.get(agentId);
       if (existingInvite?.room_id && existingInvite?.legal_agreement_id && existingRoom?.id) {
         console.log('[createInvitesAfterInvestorSign] Invite already exists for agent:', agentId, ', skipping');
         createdInvites.push(existingInvite.id);
         continue;
       }

        // Check for existing room
        let room = existingRoomsByAgent.get(agentId);
        if (!room) {
          // 1. Create Room - ACCEPTED status so agent sees it immediately
          room = await base44.asServiceRole.entities.Room.create({
            deal_id: deal_id,
            investorId: profile.id,
            agentId: agentId,
            request_status: 'accepted', // CRITICAL: accepted, not requested
            agreement_status: 'investor_signed',
            title: deal.title,
            property_address: deal.property_address,
            city: deal.city,
            state: deal.state,
            county: deal.county,
            zip: deal.zip,
            budget: deal.purchase_price,
            closing_date: deal.key_dates?.closing_date,
            proposed_terms: deal.proposed_terms,
            requested_at: new Date().toISOString(),
            accepted_at: new Date().toISOString()
          });
          console.log('[createInvitesAfterInvestorSign] ✓ Created room (accepted):', room.id);
        } else if (room.request_status !== 'accepted') {
          // Update existing room to accepted
          await base44.asServiceRole.entities.Room.update(room.id, {
            request_status: 'accepted',
            agreement_status: 'investor_signed',
            accepted_at: new Date().toISOString()
          });
          console.log('[createInvitesAfterInvestorSign] ✓ Updated room to accepted:', room.id);
        }

        // 2. Check if agreement already exists, otherwise generate
        let agreement;
        if (existingInvite?.legal_agreement_id) {
          const existingAg = await base44.asServiceRole.entities.LegalAgreement.filter({ 
            id: existingInvite.legal_agreement_id 
          }).then(arr => arr[0]);
          if (existingAg) {
            agreement = existingAg;
            console.log('[createInvitesAfterInvestorSign] Using existing agreement:', agreement.id);
          }
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
          console.log('[createInvitesAfterInvestorSign] Generated agreement:', agreement.id);
        }
        
        // 3. Update room with agreement ID if not already set
        if (!room.current_legal_agreement_id) {
          await base44.asServiceRole.entities.Room.update(room.id, {
            current_legal_agreement_id: agreement.id,
            agreement_status: 'sent'
          });
        }
        
        // 4. Create or update DealInvite
        let invite;
        if (existingInvite) {
          // Update existing invite with new agreement
          await base44.asServiceRole.entities.DealInvite.update(existingInvite.id, {
            legal_agreement_id: agreement.id,
            status: 'PENDING_AGENT_SIGNATURE',
            room_id: room.id
          });
          invite = existingInvite;
          console.log('[createInvitesAfterInvestorSign] Updated existing invite for agent:', agentId);
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
          console.log('[createInvitesAfterInvestorSign] Created DealInvite:', invite.id);
        }
        
        createdInvites.push(invite.id);
        
      } catch (error) {
        console.error('[createInvitesAfterInvestorSign] Failed for agent', agentId, ':', error);
        // Continue with other agents
      }
    }
    
    // CRITICAL: Only mark deal active if at least 1 invite was successfully created
    if (createdInvites.length === 0) {
     console.log('[createInvitesAfterInvestorSign] No invites were created successfully');
     return Response.json({ 
       ok: false,
       error: 'No invites/rooms created. Deal remains pending.',
       invite_ids: []
     }, { status: 400 });
    }

    // Update deal status only if we have created at least 1 invite
    await base44.asServiceRole.entities.Deal.update(deal_id, {
     status: 'active',
     metadata: {
       ...deal.metadata,
       pending_agreement_generation: false,
       invites_created_at: new Date().toISOString()
     }
    });

    console.log('[createInvitesAfterInvestorSign] Created', createdInvites.length, 'invites successfully');

    return Response.json({ 
     ok: true, 
     invite_ids: createdInvites,
     locked: false
    });
    
  } catch (error) {
    console.error('[createInvitesAfterInvestorSign] Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});