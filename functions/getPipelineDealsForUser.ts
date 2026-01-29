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

    console.log('[getPipelineDealsForUser]', {
      profile_id: profile.id,
      user_id: user.id,
      user_role: profile.user_role,
      isAgent,
      isInvestor
    });

    // Fetch deals based on role
    let deals = [];
    let agentRooms = [];
    
    if (isInvestor) {
      // Investors: show deals they have rooms for OR deals they've signed agreements for
      let investorRooms = await base44.entities.Room.filter({ investorId: profile.id });
      const roomDealIds = Array.from(new Set(investorRooms.map(r => r.deal_id).filter(Boolean)));
      
      // Get deals via rooms
      const byRooms = roomDealIds.length
        ? await Promise.all(roomDealIds.map(id => base44.entities.Deal.filter({ id }).then(arr => arr[0]).catch(() => null)))
        : [];
      
      // Get deals where investor has signed an agreement
      const signedAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ 
        investor_user_id: user.id,
        status: { $in: ['investor_signed', 'fully_signed', 'attorney_review_pending'] }
      });
      const signedDealIds = Array.from(new Set(signedAgreements.map(a => a.deal_id).filter(Boolean)));
      const bySigned = signedDealIds.length
        ? await Promise.all(signedDealIds.map(id => base44.entities.Deal.filter({ id }).then(arr => arr[0]).catch(() => null)))
        : [];
      
      // Merge and deduplicate by ID (keep most recently updated)
      const dealMap = new Map();
      [...byRooms.filter(Boolean), ...bySigned.filter(Boolean)].forEach(d => {
        if (!d?.id) return;
        const existing = dealMap.get(d.id);
        if (!existing || new Date(d.updated_date || 0) > new Date(existing.updated_date || 0)) {
          dealMap.set(d.id, d);
        }
      });
      deals = Array.from(dealMap.values());
      console.log('[getPipelineDealsForUser] Investor deals via rooms:', byRooms.filter(Boolean).length, 'via signed agreements:', bySigned.filter(Boolean).length, 'final:', deals.length);
    } else if (isAgent) {
      // Agents see deals they're assigned to OR deals where they have a room
      const agentDeals = await base44.entities.Deal.filter({ agent_id: profile.id });
      agentRooms = await base44.entities.Room.filter({ agentId: profile.id });
      const roomDealIds = agentRooms.map(r => r.deal_id).filter(Boolean);
      
      console.log('[getPipelineDealsForUser] Agent data:', {
        agentDeals: agentDeals.length,
        agentRooms: agentRooms.length,
        roomDealIds: roomDealIds,
        rooms: agentRooms.map(r => ({ id: r.id, deal_id: r.deal_id, request_status: r.request_status }))
      });
      
      // Merge deals from both sources + fallback by created_by
      let byCreator = [];
      try {
        byCreator = await base44.asServiceRole.entities.Deal.filter({ created_by: user.email });
      } catch (_) {}

      const allDealIds = new Set([
        ...agentDeals.map(d => d.id),
        ...roomDealIds,
        ...byCreator.map(d => d.id)
      ]);
      
      console.log('[getPipelineDealsForUser] All deal IDs to fetch:', Array.from(allDealIds));
      
      // Fetch and deduplicate by ID (keep most recently updated)
      const dealMap = new Map();
      const fetchedDeals = await Promise.all(
        Array.from(allDealIds).map(id => 
          base44.entities.Deal.filter({ id }).then(arr => arr[0]).catch(() => null)
        )
      );
      
      [...agentDeals, ...fetchedDeals.filter(Boolean), ...byCreator].forEach(d => {
        if (!d?.id) return;
        const existing = dealMap.get(d.id);
        if (!existing || new Date(d.updated_date || 0) > new Date(existing.updated_date || 0)) {
          dealMap.set(d.id, d);
        }
      });
      deals = Array.from(dealMap.values());
      
      console.log('[getPipelineDealsForUser] Final agent deals:', deals.length);
    }

    // If no deals found, try a broad fallback: any rooms for this profile, then load those deals
    if (!deals || deals.length === 0) {
      try {
        const myRooms = isInvestor
          ? await base44.entities.Room.filter({ investorId: profile.id })
          : await base44.entities.Room.filter({ agentId: profile.id });
        const rIds = Array.from(new Set(myRooms.map(r => r.deal_id).filter(Boolean)));
        if (rIds.length) {
          const fromRooms = await Promise.all(rIds.map(id => base44.entities.Deal.filter({ id }).then(a => a[0]).catch(() => null)));
          deals = (fromRooms || []).filter(Boolean);
          console.log('[getPipelineDealsForUser] Fallback via rooms produced deals:', deals.length);
        }
      } catch (e) {
        console.warn('[getPipelineDealsForUser] Room fallback failed:', e);
      }
    }

    // Fetch all LegalAgreements for these deals (BEFORE mapping)
    const dealIds = deals.map(d => d.id);
    let agreementsMap = new Map();
    if (dealIds.length > 0) {
      try {
        const allAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({
          deal_id: { $in: dealIds }
        });
        allAgreements.forEach(a => agreementsMap.set(a.deal_id, a));
        console.log('[getPipelineDealsForUser] Loaded agreements:', allAgreements.length);
      } catch (e) {
        console.error('Error fetching agreements:', e);
      }
    }

    // Agents see deals regardless of signing status
    // (remove any restrictive gates to allow newly-sent deals to show immediately)

    // PHASE 6/7: Agent filtering - exclude deals locked to other agents
    const agentFilteredDeals = isAgent 
      ? deals.filter(deal => {
          // Exclude deals locked to a different agent
          if (deal.locked_agent_id && deal.locked_agent_id !== profile.id) {
            return false;
          }
          return true;
        })
      : deals;

    // Apply role-based redaction
    const redactedDeals = agentFilteredDeals.map(deal => {
      // Get room for this deal to check signature status
      const rooms = isAgent 
        ? agentRooms?.filter(r => r.deal_id === deal.id) || []
        : [];
      const room = rooms[0];
      
      // Get LegalAgreement status (source of truth for gating)
      const agreement = agreementsMap.get(deal.id);
      const isFullySigned = agreement?.status === 'fully_signed' || 
                           agreement?.status === 'attorney_review_pending' ||
                           room?.agreement_status === 'fully_signed' || 
                           room?.request_status === 'signed';

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
        locked_room_id: deal.locked_room_id,
        locked_agent_id: deal.locked_agent_id,
        connected_at: deal.connected_at,
        is_fully_signed: isFullySigned,
        proposed_terms: deal.proposed_terms
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