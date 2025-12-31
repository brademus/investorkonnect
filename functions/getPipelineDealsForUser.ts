import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Server-side access control for pipeline deals
 * Returns redacted deal data based on user role and agreement status
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to determine role
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const userRole = profile.user_role || profile.role;
    const isInvestor = userRole === 'investor';
    const isAgent = userRole === 'agent';

    // Get deals based on role
    const filterKey = isAgent ? { agent_id: profile.id } : { investor_id: profile.id };
    const deals = await base44.asServiceRole.entities.Deal.filter(filterKey);

    // For agents, get all their rooms to check agreement status
    let agentRooms = [];
    if (isAgent) {
      agentRooms = await base44.asServiceRole.entities.Room.filter({ agentId: profile.id });
    }

    // Build room map for quick lookup
    const roomsByDealId = new Map();
    if (isAgent) {
      agentRooms.forEach(room => {
        if (room.deal_id) {
          roomsByDealId.set(room.deal_id, room);
        }
      });
    }

    // Redact deals based on role and agreement status
    const redactedDeals = deals
      .filter(d => d.status !== 'archived')
      .map(deal => {
        const room = isAgent ? roomsByDealId.get(deal.id) : null;
        const isFullySigned = room?.agreement_status === 'fully_signed' || 
                             room?.request_status === 'signed';

        // Base fields available to all
        const base = {
          id: deal.id,
          deal_id: deal.id,
          title: deal.title,
          city: deal.city,
          state: deal.state,
          county: deal.county,
          zip: deal.zip,
          budget: deal.purchase_price,
          pipeline_stage: deal.pipeline_stage,
          status: deal.status,
          created_date: deal.created_date,
          updated_date: deal.updated_date,
          closing_date: deal.key_dates?.closing_date,
          agent_id: deal.agent_id,
          investor_id: deal.investor_id
        };

        // Investors get full access
        if (isInvestor) {
          return {
            ...base,
            property_address: deal.property_address,
            seller_info: deal.seller_info,
            property_details: deal.property_details,
            special_notes: deal.special_notes,
            notes: deal.notes,
            is_fully_signed: true // Investors always see full data
          };
        }

        // Agents get limited access until fully signed
        if (isAgent) {
          if (isFullySigned) {
            return {
              ...base,
              property_address: deal.property_address,
              seller_info: deal.seller_info,
              property_details: deal.property_details,
              is_fully_signed: true
            };
          } else {
            // Limited access - only city/state/budget
            return {
              ...base,
              property_address: null, // REDACTED
              seller_info: null, // REDACTED
              property_details: deal.property_details, // Property specs are OK
              is_fully_signed: false,
              redaction_reason: room?.request_status === 'requested' 
                ? 'pending_acceptance' 
                : 'pending_signature'
            };
          }
        }

        // Default fallback
        return base;
      });

    return Response.json({ 
      deals: redactedDeals,
      user_role: userRole 
    });

  } catch (error) {
    console.error('getPipelineDealsForUser error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch deals' 
    }, { status: 500 });
  }
});