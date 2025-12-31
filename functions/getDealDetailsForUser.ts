import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Server-side access control for single deal details
 * Returns redacted deal data based on user role and agreement status
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

    // Get user profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const userRole = profile.user_role || profile.role;

    // Get deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = deals[0];
    
    if (!deal) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Verify user has access to this deal
    if (userRole === 'investor' && deal.investor_id !== profile.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    
    if (userRole === 'agent' && deal.agent_id !== profile.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get room if agent to check agreement status
    let isFullySigned = true; // Investors always get full access
    
    if (userRole === 'agent') {
      const rooms = await base44.asServiceRole.entities.Room.filter({ 
        deal_id: dealId,
        agentId: profile.id 
      });
      const room = rooms[0];
      isFullySigned = room?.agreement_status === 'fully_signed' || 
                     room?.request_status === 'signed';
    }

    // Build response with appropriate redaction
    const response = {
      id: deal.id,
      title: deal.title,
      description: deal.description,
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
      property_type: deal.property_type,
      property_details: deal.property_details,
      agent_id: deal.agent_id,
      investor_id: deal.investor_id,
      documents: deal.documents, // Document URLs handled separately
      is_fully_signed: isFullySigned
    };

    // Add sensitive fields only if allowed
    if (userRole === 'investor' || isFullySigned) {
      response.property_address = deal.property_address;
      response.seller_info = deal.seller_info;
      response.notes = deal.notes;
      response.special_notes = deal.special_notes;
    } else {
      response.property_address = null;
      response.seller_info = null;
      response.redaction_reason = 'pending_signature';
    }

    return Response.json(response);

  } catch (error) {
    console.error('getDealDetailsForUser error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch deal' 
    }, { status: 500 });
  }
});