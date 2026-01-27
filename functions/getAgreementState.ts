import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[getAgreementState] Rate limited, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deal_id, force_refresh } = await req.json();
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }

    console.log('[getAgreementState] Loading for deal:', deal_id, 'force_refresh:', force_refresh);
    
    // Load deal
    const deal = await withRetry(async () => {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      if (!deals?.length) throw new Error('Deal not found');
      return deals[0];
    });

    // Get active LegalAgreement (single source of truth with backwards compatibility)
    let agreement = null;
    
    // Resolution order:
    // 1) Use deal.current_legal_agreement_id if set and not superseded
    if (deal.current_legal_agreement_id) {
      const a = await withRetry(async () => 
        base44.asServiceRole.entities.LegalAgreement.filter({ id: deal.current_legal_agreement_id })
      );
      const candidate = a?.[0] || null;
      
      // If superseded/voided, fall back to latest non-superseded
      if (candidate && (candidate.status === 'superseded' || candidate.status === 'voided')) {
        console.log('[getAgreementState] Current pointer is superseded, finding latest active');
        const allAgreements = await withRetry(async () => 
          base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 10)
        );
        agreement = allAgreements?.find(a => a.status !== 'superseded' && a.status !== 'voided') || null;
      } else {
        agreement = candidate;
      }
      
      console.log('[getAgreementState] Resolved agreement by ID:', {
        id: agreement?.id,
        status: agreement?.status,
        investor_signed_at: agreement?.investor_signed_at,
        agent_signed_at: agreement?.agent_signed_at,
        docusign_status: agreement?.docusign_status
      });
    }
    
    // 2) Fallback: latest non-superseded LegalAgreement for this deal (legacy compatibility)
    if (!agreement) {
      const allAgreements = await withRetry(async () => 
        base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 10)
      );
      agreement = allAgreements?.find(a => a.status !== 'superseded' && a.status !== 'voided') || allAgreements?.[0] || null;
      console.log('[getAgreementState] Fallback to latest non-superseded:', {
        id: agreement?.id,
        status: agreement?.status,
        investor_signed_at: agreement?.investor_signed_at,
        agent_signed_at: agreement?.agent_signed_at
      });
    }

    // Get pending counter (latest first)
    let pending_counter = null;
    try {
      const counters = await withRetry(async () => {
        return await base44.asServiceRole.entities.CounterOffer.filter({
          deal_id,
          status: 'pending'
        }, '-created_date', 1);
      });

      pending_counter = counters?.[0] || null;
      
      // Backwards compatibility: if terms_delta is missing but terms exists, treat terms as terms_delta
      if (pending_counter && !pending_counter.terms_delta && pending_counter.terms) {
        console.log('[getAgreementState] Applying legacy terms → terms_delta compatibility');
        pending_counter.terms_delta = pending_counter.terms;
      }
      
      console.log('[getAgreementState] Pending counter:', pending_counter?.id || 'none');
    } catch (e) {
      console.log('[getAgreementState] Counter error:', e.message);
    }

    // Derived stage fields for easier UI consumption
    const investor_signed = !!agreement?.investor_signed_at;
    const agent_signed = !!agreement?.agent_signed_at;
    const fully_signed = investor_signed && agent_signed;

    return Response.json({
      success: true,
      agreement,
      pending_counter,
      deal_terms: deal.proposed_terms || {},
      requires_regenerate: !!deal.requires_regenerate,
      // Helper flags
      investor_signed,
      agent_signed,
      fully_signed
    });
    
  } catch (error) {
    console.error('[getAgreementState] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});