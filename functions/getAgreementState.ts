import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get current agreement state for a deal
 * Returns: active agreement, pending counter offer, and version info
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { deal_id } = await req.json();
    
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Get profile to check role
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Load deal
    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deals || deals.length === 0) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }
    const deal = deals[0];
    
    // Get latest version (from AgreementVersion entity - primary)
    const versions = await base44.asServiceRole.entities.AgreementVersion.filter({ 
      deal_id 
    }, '-version', 100);

    console.log('[getAgreementState] Versions found:', versions.length, versions.map(v => ({ v: v.version, s: v.status })));

    // Find active version (latest non-superseded)
    const latestVersion = versions.find(v => v.status !== 'superseded' && v.status !== 'voided') || null;
    console.log('[getAgreementState] Latest active version:', latestVersion?.version, latestVersion?.status);

    // Get active agreement (from LegalAgreement entity - legacy fallback)
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    const legacyAgreement = agreements[0] || null;

    // Use AgreementVersion if available, fallback to LegalAgreement
    const agreement = latestVersion ? {
      id: latestVersion.id,
      deal_id: latestVersion.deal_id,
      status: latestVersion.status,
      version: latestVersion.version,
      investor_signed_at: latestVersion.investor_signed_at,
      agent_signed_at: latestVersion.agent_signed_at,
      signed_pdf_url: latestVersion.signed_pdf_url,
      final_pdf_url: latestVersion.pdf_url,
      docusign_pdf_url: latestVersion.docusign_pdf_url,
      exhibit_a_terms: latestVersion.terms_snapshot || {}
    } : legacyAgreement;
    
    // Get pending counter offers
    const pendingCounters = await base44.asServiceRole.entities.CounterOffer.filter({
      deal_id,
      status: 'pending'
    }, '-created_date', 1);

    let pendingCounter = null;
    if (pendingCounters && pendingCounters.length > 0) {
      const raw = pendingCounters[0];
      // Map fields to match AgreementPanel expectations
      pendingCounter = {
        id: raw.id,
        deal_id: raw.deal_id,
        from_role: raw.from_role,
        to_role: raw.from_role === 'agent' ? 'investor' : 'agent',
        status: raw.status,
        terms_delta: raw.terms || raw.terms_delta || {},
        responded_by_role: raw.responded_by_role
      };
    }
    
    // Determine if terms mismatch
    let termsMismatch = false;
    if (agreement && deal.proposed_terms) {
      const t = deal.proposed_terms;
      const a = agreement.exhibit_a_terms || {};
      
      if (t.buyer_commission_type === 'percentage') {
        termsMismatch = !(a.compensation_model === 'COMMISSION_PCT' && 
                         Number(a.commission_percentage || 0) === Number(t.buyer_commission_percentage || 0));
      } else if (t.buyer_commission_type === 'flat') {
        termsMismatch = !(a.compensation_model === 'FLAT_FEE' && 
                         Number(a.flat_fee_amount || 0) === Number(t.buyer_flat_fee || 0));
      }
    }
    
    console.log('[getAgreementState] Final response:', {
      hasAgreement: !!agreement,
      hasPendingCounter: !!pendingCounter,
      pendingCounterData: pendingCounter
    });

    return Response.json({
      success: true,
      agreement,
      latest_version: latestVersion,
      pending_counter: pendingCounter,
      terms_mismatch: termsMismatch,
      deal_terms: deal.proposed_terms
    });
    
  } catch (error) {
    console.error('[getAgreementState] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});