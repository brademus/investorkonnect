import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get pipeline deals for current user with role-based redaction.
 * Simplified v2: no retries, no legacy fallbacks, clean logic.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const isAdmin = profile.role === 'admin' || user.role === 'admin';
    const isAgent = profile.user_role === 'agent';
    const isInvestor = profile.user_role === 'investor';

    let deals = [];

    if (isAdmin) {
      deals = await base44.asServiceRole.entities.Deal.list('-updated_date', 100);
    } else if (isInvestor) {
      deals = await base44.entities.Deal.filter({ investor_id: profile.id, status: { $ne: 'draft' } });
    } else if (isAgent) {
      // Only show deals where agent has an active invite (not VOIDED/EXPIRED)
      const invites = await base44.asServiceRole.entities.DealInvite.filter({ agent_profile_id: profile.id });
      const activeInvites = invites.filter(i => i.status !== 'VOIDED' && i.status !== 'EXPIRED');
      const inviteDealIds = activeInvites.map(i => i.deal_id).filter(Boolean);

      // Also check direct assignment (legacy)
      const directDeals = await base44.entities.Deal.filter({ agent_id: profile.id });
      const directIds = directDeals.map(d => d.id);

      const allIds = [...new Set([...inviteDealIds, ...directIds])];

      if (allIds.length > 0) {
        const fetched = await Promise.all(allIds.map(id => base44.entities.Deal.filter({ id }).then(a => a[0]).catch(() => null)));
        deals = fetched.filter(Boolean);
      }
      // Filter out deals locked to other agents
      deals = deals.filter(d => !d.locked_agent_id || d.locked_agent_id === profile.id);
    }

    // Deduplicate
    const map = new Map();
    deals.filter(d => d?.id && d.status !== 'archived').forEach(d => {
      const prev = map.get(d.id);
      if (!prev || new Date(d.updated_date || 0) > new Date(prev.updated_date || 0)) map.set(d.id, d);
    });

    // Load agreements for signing status
    const dealIds = [...map.keys()];
    const agreementMap = new Map();
    if (dealIds.length > 0) {
      const allAg = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: { $in: dealIds } });
      allAg.forEach(a => { if (!agreementMap.has(a.deal_id)) agreementMap.set(a.deal_id, a); });
    }

    // Redact based on role
    const redacted = [...map.values()].map(deal => {
      const ag = agreementMap.get(deal.id);
      const isSigned = ag?.status === 'fully_signed' || ag?.status === 'attorney_review_pending';

      const base = {
        id: deal.id, title: deal.title, city: deal.city, state: deal.state, county: deal.county, zip: deal.zip,
        purchase_price: deal.purchase_price, pipeline_stage: deal.pipeline_stage, status: deal.status,
        created_date: deal.created_date, updated_date: deal.updated_date, key_dates: deal.key_dates,
        investor_id: deal.investor_id, agent_id: deal.agent_id,
        locked_room_id: deal.locked_room_id, locked_agent_id: deal.locked_agent_id,
        selected_agent_ids: deal.selected_agent_ids, is_fully_signed: isSigned,
        proposed_terms: deal.proposed_terms
      };

      if (isAdmin || isInvestor || isSigned) {
        return { ...base, property_address: deal.property_address, seller_info: deal.seller_info, property_details: deal.property_details, documents: deal.documents, special_notes: deal.special_notes };
      }
      return { ...base, property_address: null, seller_info: null, property_details: null, documents: null, special_notes: null };
    });

    return Response.json({ deals: redacted, role: profile.user_role });
  } catch (error) {
    console.error('[getPipelineDeals] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});