import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Server-Side Access Control: Get Single Deal Details
 * 
 * Enforces role-based field-level access control:
 * - Agents: Limited info until agreement fully signed
 * - Investors: Full access to their own deals
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dealId } = await req.json();
    
    if (!dealId) {
      return Response.json({ error: 'dealId required' }, { status: 400 });
    }

    // Get user's profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch deal
    const deals = await base44.entities.Deal.filter({ id: dealId });
    const deal = deals[0];
    
    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    // Verify access rights
    if (isInvestor && deal.investor_id !== profile.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    if (isAgent && deal.agent_id !== profile.id) {
      // Check if agent has a room for this deal
      const agentRooms = await base44.entities.Room.filter({ 
        deal_id: dealId,
        agentId: profile.id 
      });
      
      if (agentRooms.length === 0) {
        return Response.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get room to check signature status
    let room = null;
    if (isAgent) {
      const rooms = await base44.entities.Room.filter({ 
        deal_id: dealId,
        agentId: profile.id 
      });
      room = rooms[0];
    } else if (isInvestor) {
      const rooms = await base44.entities.Room.filter({ 
        deal_id: dealId,
        investorId: profile.id 
      });
      room = rooms[0];
    }

    // Get LegalAgreement status (source of truth for gating)
    let isFullySigned = false;
    try {
      const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: dealId });
      if (agreements.length > 0) {
        const agreement = agreements[0];
        isFullySigned = agreement.status === 'fully_signed';
      }
    } catch (e) {
      // LegalAgreement may not exist yet - fallback to Room status
      isFullySigned = room?.agreement_status === 'fully_signed' || room?.request_status === 'signed';
    }

    // Base fields everyone can see
    const baseDeal = {
      id: deal.id,
      title: deal.title,
      city: deal.city,
      state: deal.state,
      county: deal.county,
      zip: deal.zip,
      purchase_price: deal.purchase_price,
      pipeline_stage: deal.pipeline_stage,
      status: deal.status,
      created_date: deal.created_date,
      updated_date: deal.updated_date,
      key_dates: deal.key_dates,
      investor_id: deal.investor_id,
      agent_id: deal.agent_id,
      is_fully_signed: isFullySigned
    };

    // Sensitive fields - only visible to investors OR fully signed agents
    if (isInvestor || isFullySigned) {
      return Response.json({
        ...baseDeal,
        property_address: deal.property_address,
        seller_info: deal.seller_info,
        property_details: deal.property_details,
        documents: deal.documents,
        notes: deal.notes,
        special_notes: deal.special_notes,
        audit_log: deal.audit_log
      });
    }

    // Agents see limited info until fully signed
    return Response.json({
      ...baseDeal,
      property_address: null, // Hidden
      seller_info: null, // Hidden
      property_details: null, // Hidden
      documents: null, // Hidden
      notes: null, // Hidden
      special_notes: null // Hidden
    });
  } catch (error) {
    console.error('getDealDetailsForUser error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});