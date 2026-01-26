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
    
    // Get active agreement (from LegalAgreement entity - legacy)
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
    const agreement = agreements[0] || null;
    
    // Get latest version (from AgreementVersion entity - new)
    const versions = await base44.asServiceRole.entities.AgreementVersion.filter({ 
      deal_id 
    }, '-version', 1);
    const latestVersion = versions[0] || null;
    
    // Get pending counter offers
    const pendingCounters = await base44.asServiceRole.entities.CounterOffer.filter({
      deal_id,
      status: 'pending'
    }, '-created_date', 1);
    const pendingCounter = pendingCounters[0] || null;
    
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