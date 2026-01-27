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
      // Investors: include deals by investor_id, plus deals tied via Rooms, plus fallback by created_by
      const byInvestorId = await base44.entities.Deal.filter({ investor_id: profile.id });
      let investorRooms = await base44.entities.Room.filter({ investorId: profile.id });
      const roomDealIds = Array.from(new Set(investorRooms.map(r => r.deal_id).filter(Boolean)));
      const byRooms = roomDealIds.length
        ? await Promise.all(roomDealIds.map(id => base44.entities.Deal.filter({ id }).then(arr => arr[0]).catch(() => null)))
        : [];
      // Fallback: include deals created by this user (in case of profile dedup migrations)
      let byCreator = [];
      try {
        byCreator = await base44.asServiceRole.entities.Deal.filter({ created_by: user.email });
      } catch (_) {}
      const merged = [...byInvestorId, ...byRooms.filter(Boolean), ...byCreator];
      // de-dupe by id
      const seen = new Set();
      deals = merged.filter(d => d && !seen.has(d.id) && seen.add(d.id));
      console.log('[getPipelineDealsForUser] Investor deals via investor_id:', byInvestorId.length, 'via rooms:', byRooms.filter(Boolean).length, 'via created_by:', byCreator.length, 'final:', deals.length);
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
      
      deals = await Promise.all(
        Array.from(allDealIds).map(id => 
          base44.entities.Deal.filter({ id }).then(arr => arr[0])
        )
      );
      deals = deals.filter(Boolean);
      
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

    // Fetch all LegalAgreements and AgreementVersions for these deals
    const dealIds = deals.map(d => d.id);
    let agreementsMap = new Map();
    if (dealIds.length > 0) {
      try {
        // Load LegalAgreements
        const allAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({
          deal_id: { $in: dealIds }
        });
        allAgreements.forEach(a => agreementsMap.set(a.deal_id, a));
        console.log('[getPipelineDealsForUser] Loaded LegalAgreements:', allAgreements.length);
        
        // Also load AgreementVersions (newer system)
        const allVersions = await base44.asServiceRole.entities.AgreementVersion.filter({
          deal_id: { $in: dealIds }
        }, '-version', 100);
        
        // For each deal, use the latest version if it exists and has investor_signed_at
        allVersions.forEach(v => {
          const existing = agreementsMap.get(v.deal_id);
          // Prefer version with investor_signed_at, or if no existing agreement
          if (!existing || (v.investor_signed_at && !existing.investor_signed_at)) {
            agreementsMap.set(v.deal_id, v);
          }
        });
        console.log('[getPipelineDealsForUser] Loaded AgreementVersions:', allVersions.length);
      } catch (e) {
        console.error('Error fetching agreements:', e);
      }
    }

    // Agents should see deals after the INVESTOR has signed
    if (isAgent && deals.length > 0) {
      deals = deals.filter(d => {
        // Check LegalAgreement for investor_signed_at
        const ag = agreementsMap.get(d.id);
        if (ag && ag.investor_signed_at) {
          console.log('[getPipelineDealsForUser] Deal', d.id, 'allowed: LegalAgreement has investor_signed_at');
          return true;
        }
        
        // Check AgreementVersion entities for investor_signed_at
        // (we'll load these below if needed)
        
        // Check Room agreement_status as fallback
        const hasRoomSignal = (agentRooms || []).some(r => r.deal_id === d.id && (
          r.agreement_status === 'investor_signed' || r.agreement_status === 'agent_signed' || r.agreement_status === 'fully_signed'
        ));
        
        if (hasRoomSignal) {
          console.log('[getPipelineDealsForUser] Deal', d.id, 'allowed: Room shows investor_signed or better');
          return true;
        }
        
        console.log('[getPipelineDealsForUser] Deal', d.id, 'filtered out: no investor signature found');
        return false;
      });
      
      console.log('[getPipelineDealsForUser] Agent deals after filtering:', deals.length);
    }

    // Apply role-based redaction
    const redactedDeals = deals.map(deal => {
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