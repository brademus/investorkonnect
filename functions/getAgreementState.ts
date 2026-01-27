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
    
    const { deal_id } = await req.json();
    if (!deal_id) {
      return Response.json({ error: 'deal_id required' }, { status: 400 });
    }
    
    // Load deal
    const deal = await withRetry(async () => {
      const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
      if (!deals?.length) throw new Error('Deal not found');
      return deals[0];
    });

    // Get active LegalAgreement (single source of truth)
    let agreement = null;
    if (deal.current_legal_agreement_id) {
      const a = await withRetry(async () => 
        base44.asServiceRole.entities.LegalAgreement.filter({ id: deal.current_legal_agreement_id })
      );
      agreement = a?.[0] || null;
    }
    
    // Fallback: latest LegalAgreement for this deal
    if (!agreement) {
      const a = await withRetry(async () => 
        base44.asServiceRole.entities.LegalAgreement.filter({ deal_id }, '-created_date', 1)
      );
      agreement = a?.[0] || null;
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
      console.log('[getAgreementState] Pending counter:', pending_counter?.id || 'none');
    } catch (e) {
      console.log('[getAgreementState] Counter error:', e.message);
    }

    return Response.json({
      success: true,
      agreement,
      pending_counter,
      deal_terms: deal.proposed_terms || {},
      requires_regenerate: !!deal.requires_regenerate
    });
    
  } catch (error) {
    console.error('[getAgreementState] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});