import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Server-side enriched rooms list
 * Returns rooms with counterparty profiles and deal summaries pre-loaded
 * Eliminates client-side N+1 queries
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const userRole = profile.user_role || profile.role;

    // Get all rooms for this user
    const rooms = userRole === 'investor'
      ? await base44.asServiceRole.entities.Room.filter({ investorId: profile.id })
      : await base44.asServiceRole.entities.Room.filter({ agentId: profile.id });

    // Get all unique deal IDs
    const dealIds = [...new Set(rooms.map(r => r.deal_id).filter(Boolean))];
    
    // Get all deals at once
    const allDeals = dealIds.length > 0
      ? await base44.asServiceRole.entities.Deal.filter({ id: { $in: dealIds } })
      : [];
    
    const dealMap = new Map(allDeals.map(d => [d.id, d]));

    // Get all unique counterparty profile IDs
    const counterpartyIds = [...new Set(
      rooms.map(r => userRole === 'investor' ? r.agentId : r.investorId).filter(Boolean)
    )];
    
    // Get all counterparty profiles at once
    const counterpartyProfiles = counterpartyIds.length > 0
      ? await base44.asServiceRole.entities.Profile.filter({ id: { $in: counterpartyIds } })
      : [];
    
    const profileMap = new Map(counterpartyProfiles.map(p => [p.id, p]));

    // Enrich rooms
    const enrichedRooms = rooms.map(room => {
      const deal = dealMap.get(room.deal_id);
      const counterpartyId = userRole === 'investor' ? room.agentId : room.investorId;
      const counterpartyProfile = profileMap.get(counterpartyId);
      
      const isFullySigned = room.agreement_status === 'fully_signed' || 
                           room.request_status === 'signed';

      // Base room data
      const enriched = {
        id: room.id,
        deal_id: room.deal_id,
        request_status: room.request_status,
        agreement_status: room.agreement_status,
        created_date: room.created_date,
        updated_date: room.updated_date,
        
        // Counterparty info
        counterparty_id: counterpartyId,
        counterparty_name: counterpartyProfile?.full_name || 'Unknown',
        counterparty_role: userRole === 'investor' ? 'agent' : 'investor',
        counterparty_avatar: counterpartyProfile?.headshotUrl,
        
        // Deal summary (redacted for agents if not signed)
        deal_summary: deal ? {
          title: deal.title,
          city: deal.city,
          state: deal.state,
          budget: deal.purchase_price,
          pipeline_stage: deal.pipeline_stage,
          closing_date: deal.key_dates?.closing_date,
          // Sensitive fields only if allowed
          property_address: (userRole === 'investor' || isFullySigned) 
            ? deal.property_address 
            : null,
          seller_name: (userRole === 'investor' || isFullySigned) 
            ? deal.seller_info?.seller_name 
            : null
        } : null,
        
        is_fully_signed: isFullySigned,
        
        // Legacy fields for compatibility
        title: deal?.title || room.title,
        property_address: (userRole === 'investor' || isFullySigned) 
          ? (deal?.property_address || room.property_address)
          : null,
        city: deal?.city || room.city,
        state: deal?.state || room.state,
        budget: deal?.purchase_price || room.budget || 0
      };

      return enriched;
    });

    // Filter out orphaned rooms (no valid counterparty)
    const validRooms = enrichedRooms.filter(r => 
      r.counterparty_name && r.counterparty_name !== 'Unknown'
    );

    return Response.json({ 
      rooms: validRooms,
      count: validRooms.length 
    });

  } catch (error) {
    console.error('listMyRoomsEnriched error:', error);
    return Response.json({ 
      error: error.message || 'Failed to list rooms' 
    }, { status: 500 });
  }
});