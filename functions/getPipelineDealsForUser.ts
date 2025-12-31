import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Server-Side Access Control: Get Pipeline Deals for Current User
 * 
 * Returns deals with role-based field redaction:
 * - Agents: See only city/state/county/zip until agreement fully signed
 * - Investors: See full details for their own deals
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to determine role
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    // Fetch deals based on role
    let deals = [];
    if (isInvestor) {
      // Investors see their own deals
      deals = await base44.entities.Deal.filter({ investor_id: profile.id });
    } else if (isAgent) {
      // Agents see deals they're assigned to OR deals where they have a room
      const agentDeals = await base44.entities.Deal.filter({ agent_id: profile.id });
      const agentRooms = await base44.entities.Room.filter({ agentId: profile.id });
      const roomDealIds = agentRooms.map(r => r.deal_id).filter(Boolean);
      
      // Merge deals from both sources
      const allDealIds = new Set([
        ...agentDeals.map(d => d.id),
        ...roomDealIds
      ]);
      
      deals = await Promise.all(
        Array.from(allDealIds).map(id => 
          base44.entities.Deal.filter({ id }).then(arr => arr[0])
        )
      );
      deals = deals.filter(Boolean);
    }

    // Apply role-based redaction
    const redactedDeals = deals.map(deal => {
      // Get room for this deal to check signature status
      const rooms = isAgent 
        ? agentRooms?.filter(r => r.deal_id === deal.id) || []
        : [];
      const room = rooms[0];
      const isFullySigned = room?.agreement_status === 'fully_signed' || room?.request_status === 'signed';

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
        return {
          ...baseDeal,
          property_address: deal.property_address,
          seller_info: deal.seller_info,
          property_details: deal.property_details,
          documents: deal.documents,
          notes: deal.notes,
          special_notes: deal.special_notes
        };
      }

      // Agents see limited info until fully signed
      return {
        ...baseDeal,
        property_address: null, // Hidden
        seller_info: null, // Hidden
        property_details: null, // Hidden
        documents: null, // Hidden
        notes: null, // Hidden
        special_notes: null // Hidden
      };
    });

    return Response.json({ 
      deals: redactedDeals,
      role: profile.user_role 
    });
  } catch (error) {
    console.error('getPipelineDealsForUser error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});