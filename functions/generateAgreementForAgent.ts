import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Generate agreement for a specific agent when investor has multiple agents selected
 * This is called after investor signs - it creates the room and generates individual agreements
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const { deal_id, agent_profile_id } = body;
    
    if (!deal_id || !agent_profile_id) {
      return Response.json({ error: 'deal_id and agent_profile_id required' }, { status: 400 });
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
    
    // Check if room already exists for this agent
    const existingRooms = await base44.entities.Room.filter({ 
      deal_id: deal_id,
      agentId: agent_profile_id
    });
    
    let room;
    if (existingRooms.length > 0) {
      room = existingRooms[0];
    } else {
      // Create room
      room = await base44.asServiceRole.entities.Room.create({
        deal_id: deal_id,
        investorId: profile.id,
        agentId: agent_profile_id,
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
    }
    
    // Generate agreement for this room
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
    
    const genRes = await base44.functions.invoke('generateLegalAgreement', {
      deal_id: deal_id,
      room_id: room.id,
      exhibit_a
    });
    
    if (!genRes.data?.success) {
      throw new Error(genRes.data?.error || 'Failed to generate agreement');
    }
    
    // Update room with agreement ID
    await base44.asServiceRole.entities.Room.update(room.id, {
      current_legal_agreement_id: genRes.data.agreement.id,
      agreement_status: 'sent'
    });
    
    return Response.json({ 
      success: true, 
      room_id: room.id,
      agreement: genRes.data.agreement 
    });
    
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});