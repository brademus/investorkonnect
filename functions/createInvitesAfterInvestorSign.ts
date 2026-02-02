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
    
    console.log('[createInvitesAfterInvestorSign] Request body:', body);
    
    if (!deal_id) {
      console.error('[createInvitesAfterInvestorSign] Missing deal_id in body');
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
    
    // Verify this is the investor's deal or the user is an admin
    const isAdmin = user.role === 'admin' || profile.role === 'admin';
    if (deal.investor_id !== profile.id && !isAdmin) {
      console.error('[createInvitesAfterInvestorSign] Auth check failed:', {
        deal_investor_id: deal.investor_id,
        profile_id: profile.id,
        user_id: user.id,
        user_role: user.role,
        profile_role: profile.role
      });
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    // CRITICAL: Get selected agent IDs from MULTIPLE sources for redundancy
    let selectedAgentIds = deal.selected_agent_ids || deal.metadata?.selected_agent_ids || [];
    
    console.log('[createInvitesAfterInvestorSign] Deal.selected_agent_ids:', deal.selected_agent_ids);
    console.log('[createInvitesAfterInvestorSign] Deal.metadata?.selected_agent_ids:', deal.metadata?.selected_agent_ids);
    console.log('[createInvitesAfterInvestorSign] Final selectedAgentIds:', selectedAgentIds);
    
    if (selectedAgentIds.length === 0) {
      console.error('[createInvitesAfterInvestorSign] ERROR: No agents selected for deal:', deal_id);
      console.error('[createInvitesAfterInvestorSign] Full deal keys:', Object.keys(deal));
      console.error('[createInvitesAfterInvestorSign] Deal object:', JSON.stringify(deal, null, 2));
      return Response.json({ 
        error: 'No agents selected for this deal. Please contact support.',
        deal_id,
        debug: {
          deal_keys: Object.keys(deal),
          selected_agent_ids_field: deal.selected_agent_ids,
          metadata: deal.metadata,
          metadata_selected_agent_ids: deal.metadata?.selected_agent_ids
        }
      }, { status: 400 });
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
          console.log('[createInvitesAfterInvestorSign] ✓ Created room for agent:', agentId, ', room ID:', room.id, ', deal ID:', deal_id);
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
          // Get base agreement for source reference
          const baseAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
            deal_id: deal_id,
            room_id: null
          }, '-created_date', 1);
          const baseAgreement = baseAgreements?.[0];
          
          const genRes = await base44.functions.invoke('generateLegalAgreement', {
            deal_id: deal_id,
            room_id: room.id,
            signer_mode: 'agent_only', // CRITICAL: agent signs alone
            source_base_agreement_id: baseAgreement?.id || null,
            exhibit_a
          });
          
          if (!genRes.data?.success) {
            throw new Error(genRes.data?.error || 'Failed to generate agreement');
          }
          
          agreement = genRes.data.agreement;
          console.log('[createInvitesAfterInvestorSign] Generated agent-only agreement:', agreement.id);
          
          // NO NEED to copy investor signature - agent_only mode has no investor recipient
        }
        
        // 3. Update room with agreement ID - status is 'sent' (waiting for agent)
        await base44.asServiceRole.entities.Room.update(room.id, {
          current_legal_agreement_id: agreement.id,
          agreement_status: 'sent' // Agent can now sign
        });
        
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
     console.error('[createInvitesAfterInvestorSign] ERROR: No invites were created successfully');
     console.error('[createInvitesAfterInvestorSign] Selected agent IDs were:', selectedAgentIds);
     console.error('[createInvitesAfterInvestorSign] Deal metadata:', deal.metadata);
     return Response.json({ 
       ok: false,
       error: 'Failed to create invites for agents. Please contact support.',
       invite_ids: [],
       debug: {
         selected_agents: selectedAgentIds,
         deal_metadata: deal.metadata
       }
     }, { status: 500 });
    }

    // Update deal status and pipeline stage
    await base44.asServiceRole.entities.Deal.update(deal_id, {
     status: 'active',
     pipeline_stage: 'new_deals',
     metadata: {
       ...deal.metadata,
       pending_agreement_generation: false,
       invites_created_at: new Date().toISOString(),
       rooms_created: true
     }
    });

    console.log('[createInvitesAfterInvestorSign] ✓ Updated deal status to active, pipeline_stage to new_deals');

    console.log('[createInvitesAfterInvestorSign] SUCCESS: Created', createdInvites.length, 'invites for deal:', deal_id);
    console.log('[createInvitesAfterInvestorSign] Agent IDs invited:', selectedAgentIds);
    
    // Reload rooms to confirm creation
    const finalRooms = await base44.asServiceRole.entities.Room.filter({ deal_id });
    console.log('[createInvitesAfterInvestorSign] ✓ Final room count:', finalRooms.length);

    return Response.json({ 
     ok: true, 
     invite_ids: createdInvites,
     room_count: finalRooms.length,
     locked: false
    });
    
  } catch (error) {
    console.error('[createInvitesAfterInvestorSign] Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});