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
    if (selectedAgentIds.length === 0) {
      return Response.json({ error: 'No agents selected for this deal' }, { status: 400 });
    }
    
    console.log('[createInvitesAfterInvestorSign] Creating invites for', selectedAgentIds.length, 'agents');
    
    // Check if invites already exist (idempotency)
    const existingInvites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id });
    if (existingInvites.length > 0) {
      console.log('[createInvitesAfterInvestorSign] Invites already exist, skipping');
      return Response.json({ 
        ok: true, 
        message: 'Invites already created',
        invite_ids: existingInvites.map(i => i.id),
        locked: !!deal.locked_agent_profile_id
      });
    }
    
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
    
    // Create invite for each agent
    for (const agentId of selectedAgentIds) {
      try {
        // 1. Create Room for this agent
        const room = await base44.asServiceRole.entities.Room.create({
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
        
        console.log('[createInvitesAfterInvestorSign] Created room:', room.id, 'for agent:', agentId);
        
        // 2. Generate agent-specific agreement
        const genRes = await base44.functions.invoke('generateLegalAgreement', {
          deal_id: deal_id,
          room_id: room.id,
          exhibit_a
        });
        
        if (!genRes.data?.success) {
          throw new Error(genRes.data?.error || 'Failed to generate agreement');
        }
        
        const agreement = genRes.data.agreement;
        console.log('[createInvitesAfterInvestorSign] Generated agreement:', agreement.id);
        
        // 3. Update room with agreement ID
        await base44.asServiceRole.entities.Room.update(room.id, {
          current_legal_agreement_id: agreement.id,
          agreement_status: 'sent'
        });
        
        // 4. Create DealInvite
        const invite = await base44.asServiceRole.entities.DealInvite.create({
          deal_id: deal_id,
          investor_id: profile.id,
          agent_profile_id: agentId,
          room_id: room.id,
          legal_agreement_id: agreement.id,
          status: 'PENDING_AGENT_SIGNATURE',
          created_at_iso: new Date().toISOString()
        });
        
        createdInvites.push(invite.id);
        console.log('[createInvitesAfterInvestorSign] Created DealInvite:', invite.id);
        
      } catch (error) {
        console.error('[createInvitesAfterInvestorSign] Failed for agent', agentId, ':', error);
        // Continue with other agents
      }
    }
    
    // Update deal status
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