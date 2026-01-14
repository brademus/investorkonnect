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
      property_type: deal.property_type,
      property_details: deal.property_details,
      // Expose seller contract metadata so Files tab can show it even before full signing
      contract_document: deal.contract_document,
      contract_url: deal.contract_url,
      is_fully_signed: isFullySigned
    };

    // Fallback: prefer investor-entered Deal.details; if empty/blank, use Room; else try contract
    const isMeaningfulPD = (pd) => {
      if (!pd || typeof pd !== 'object') return false;
      const n = (v) => (v !== undefined && v !== null && !Number.isNaN(Number(v)));
      const s = (v) => (typeof v === 'string' ? v.trim().length > 0 : false);
      const b = (v) => (typeof v === 'boolean');
      return (
        n(pd.beds) || n(pd.baths) || n(pd.sqft) || n(pd.year_built) || s(pd.number_of_stories) || b(pd.has_basement)
      );
    };

    // Legacy top-level fields -> normalized property_details
    const legacyPD = (() => {
      const d = deal || {};
      const pickFirst = (...vals) => {
        for (const v of vals) {
          if (v === undefined || v === null) continue;
          if (typeof v === 'string') {
            const t = v.trim();
            if (t.length === 0) continue;
            return t;
          }
          return v;
        }
        return undefined;
      };
      const pd = {};
      const beds = pickFirst(d.beds, d.bedrooms, d.bedrooms_total, d.bdrms);
      if (beds !== undefined) pd.beds = Number(beds);
      const baths = pickFirst(d.baths, d.bathrooms, d.bathrooms_total, d.bathrooms_total_integer);
      if (baths !== undefined) pd.baths = Number(baths);
      const sqft = pickFirst(d.sqft, d.square_feet, d.squareFeet, d.square_footage, d.living_area, d.gross_living_area);
      if (sqft !== undefined) pd.sqft = Number(String(sqft).replace(/[^0-9.]/g, ''));
      const yearBuilt = pickFirst(d.year_built, d.yearBuilt, d.built_year);
      if (yearBuilt !== undefined) pd.year_built = Number(yearBuilt);
      const stories = pickFirst(d.number_of_stories, d.stories, d.levels, d.floors);
      if (stories !== undefined) {
        const s = String(stories).trim();
        pd.number_of_stories = (Number(s) >= 3 || s === '3+' ? '3+' : (s === '2' || s.toLowerCase() === 'two' ? '2' : (s === '1' || s.toLowerCase() === 'one' ? '1' : s)));
      }
      const basement = pickFirst(d.has_basement, d.basement, d.basement_yn);
      if (basement !== undefined) {
        const sv = String(basement).toLowerCase();
        pd.has_basement = (basement === true || ['yes','y','true','t','1'].includes(sv));
      }
      return Object.keys(pd).length ? pd : null;
    })();

    const property_details_fallback = isMeaningfulPD(baseDeal.property_details)
      ? baseDeal.property_details
      : (isMeaningfulPD(legacyPD) ? legacyPD
         : (isMeaningfulPD(room?.property_details) ? room.property_details : null));

    const property_type_fallback = baseDeal.property_type || room?.property_type || null;

    // If still missing, derive from seller contract for display (no DB writes)
    let display_property_details = property_details_fallback;
    let display_property_type = property_type_fallback || deal.property_type || deal.property_type_name || null;
    try {
      const needsPD = !isMeaningfulPD(display_property_details);
      const needsType = !display_property_type;
      if (needsPD || needsType) {
        const sellerUrl = deal?.documents?.purchase_contract?.file_url ||
                          deal?.documents?.purchase_contract?.url ||
                          deal?.contract_document?.url ||
                          deal?.contract_url;
        if (sellerUrl) {
          const { data: extraction } = await base44.functions.invoke('extractContractData', { fileUrl: sellerUrl });
          const d = extraction?.data || extraction;
          if (d) {
            if (needsType && d.property_type) display_property_type = d.property_type;
            if (needsPD && d.property_details) {
              const pd = {};
              if (d.property_details?.beds != null) pd.beds = d.property_details.beds;
              if (d.property_details?.baths != null) pd.baths = d.property_details.baths;
              if (d.property_details?.sqft != null) pd.sqft = d.property_details.sqft;
              if (d.property_details?.year_built != null) pd.year_built = d.property_details.year_built;
              if (d.property_details?.number_of_stories) pd.number_of_stories = d.property_details.number_of_stories;
              if (typeof d.property_details?.has_basement === 'boolean') pd.has_basement = d.property_details.has_basement;
              if (Object.keys(pd).length) display_property_details = pd;
            }
          }
        }
      }
    } catch (_) {}


    // Sensitive fields - only visible to investors OR fully signed agents
    if (isInvestor || isFullySigned) {
      return Response.json({
        ...baseDeal,
        property_type: display_property_type,
        property_address: deal.property_address,
        seller_info: deal.seller_info,
        property_details: display_property_details,
        documents: deal.documents,
        notes: deal.notes,
        special_notes: deal.special_notes,
        audit_log: deal.audit_log
      });
    }

    // Agents see limited info until fully signed (but show non-sensitive property details and seller contract link)
    return Response.json({
      ...baseDeal,
      property_type: display_property_type,
      property_details: display_property_details,
      property_address: null, // Hidden
      seller_info: null, // Hidden
      // Expose ONLY the seller purchase contract so Files tab can render it
      documents: deal?.documents?.purchase_contract ? { purchase_contract: deal.documents.purchase_contract } : null,
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