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
    const isAdmin = profile.role === 'admin' || user.role === 'admin';

    console.log('[getPipelineDealsForUser]', {
      profile_id: profile.id,
      user_id: user.id,
      user_role: profile.user_role,
      isAgent,
      isInvestor,
      isAdmin
    });

    // Fetch deals based on role
    let deals = [];
    let agentRooms = [];
    
    if (isAdmin) {
      // Admins see ALL deals across the platform
      deals = await base44.asServiceRole.entities.Deal.list('-updated_date', 100);
      console.log('[getPipelineDealsForUser] Admin view - showing all deals:', deals.length);
    } else if (isInvestor) {
      // Investors: show ACTIVE deals only (status != draft) + deals they have rooms for OR signed agreements
      // CRITICAL: Draft deals should NOT appear until investor signs
      const ownedDeals = await base44.entities.Deal.filter({ 
        investor_id: profile.id,
        status: { $ne: 'draft' } // Exclude draft deals
      });
      console.log('[getPipelineDealsForUser] Investor active deals (excluding drafts):', ownedDeals.length);
      
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
      [...ownedDeals, ...byRooms.filter(Boolean), ...bySigned.filter(Boolean)].forEach(d => {
        if (!d?.id) return;
        const existing = dealMap.get(d.id);
        if (!existing || new Date(d.updated_date || 0) > new Date(existing.updated_date || 0)) {
          dealMap.set(d.id, d);
        }
      });
      deals = Array.from(dealMap.values());
      console.log('[getPipelineDealsForUser] Investor deals - owned:', ownedDeals.length, 'via rooms:', byRooms.filter(Boolean).length, 'via signed agreements:', bySigned.filter(Boolean).length, 'final:', deals.length);
    } else if (isAgent) {
      // Agents see ALL deals where they have a room (regardless of request_status, city, or address)
      // CRITICAL: No filtering by address - each room is unique even if same city/state
      // RETRY: Query twice in case rooms were just created and need indexing
      agentRooms = await base44.entities.Room.filter({ agentId: profile.id });
      if (agentRooms.length === 0) {
        console.log('[getPipelineDealsForUser] No rooms on first query, retrying after 500ms...');
        await new Promise(r => setTimeout(r, 500));
        agentRooms = await base44.entities.Room.filter({ agentId: profile.id });
      }
      console.log('[getPipelineDealsForUser] Agent rooms found:', agentRooms.length, 'for agent:', profile.id);
      agentRooms.forEach(r => {
        console.log('[getPipelineDealsForUser] Room:', {
          room_id: r.id,
          deal_id: r.deal_id,
          request_status: r.request_status,
          agreement_status: r.agreement_status,
          created_date: r.created_date
        });
      });

      // Also check DealInvites for this agent
      const agentInvites = await base44.asServiceRole.entities.DealInvite.filter({ 
        agent_profile_id: profile.id 
      });
      console.log('[getPipelineDealsForUser] Agent invites:', agentInvites.length);
      agentInvites.forEach(i => {
        console.log('[getPipelineDealsForUser] Invite:', {
          invite_id: i.id,
          deal_id: i.deal_id,
          status: i.status,
          created_at: i.created_at_iso
        });
      });

      const roomDealIds = agentRooms.map(r => r.deal_id).filter(Boolean);
      const inviteDealIds = agentInvites.map(i => i.deal_id).filter(Boolean);
      
      // Also get deals where agent is directly assigned
      const agentDeals = await base44.entities.Deal.filter({ agent_id: profile.id });
      
      console.log('[getPipelineDealsForUser] Agent data:', {
        agentDeals: agentDeals.length,
        agentRooms: agentRooms.length,
        agentInvites: agentInvites.length,
        roomDealIds: roomDealIds,
        inviteDealIds: inviteDealIds,
        rooms: agentRooms.map(r => ({ id: r.id, deal_id: r.deal_id, request_status: r.request_status, agreement_status: r.agreement_status }))
      });
      
      // Merge deals from both sources + fallback by created_by
      let byCreator = [];
      try {
        byCreator = await base44.asServiceRole.entities.Deal.filter({ created_by: user.email });
      } catch (_) {}

      const allDealIds = new Set([
        ...agentDeals.map(d => d.id),
        ...roomDealIds,
        ...inviteDealIds,
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