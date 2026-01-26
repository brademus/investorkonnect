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

    // Get latest agreement version
    const versions = await withRetry(async () => {
      const all = await base44.asServiceRole.entities.AgreementVersion.filter({ deal_id }, '-version', 100);
      return all || [];
    });

    const latestVersion = versions.find(v => v.status !== 'superseded' && v.status !== 'voided') || null;
    
    // Fallback to legacy agreement
    let agreement = null;
    if (latestVersion) {
      agreement = {
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
      };
    } else {
      const legacyAgreements = await withRetry(async () => {
        const all = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id });
        return all || [];
      });
      agreement = legacyAgreements[0] || null;
    }

    // Get active counter offers (pending or accepted, not superseded/declined)
    let pendingCounter = null;
    try {
      const counters = await withRetry(async () => {
        return await base44.asServiceRole.entities.CounterOffer.filter({
          deal_id,
          status: { $in: ['pending', 'accepted'] }
        }, '-created_date', 100);
      });

      if (counters && counters.length > 0) {
        // Take the LATEST accepted counter if it exists, otherwise the latest pending
        let selected = counters.find(c => c.status === 'accepted') || counters[0];

        const raw = selected;
        pendingCounter = {
          id: raw.id,
          deal_id: raw.deal_id,
          from_role: raw.from_role,
          to_role: raw.to_role,
          status: raw.status,
          terms_delta: raw.terms_delta || {},
          responded_by_role: raw.responded_by_role
        };
        console.log('[getAgreementState] Found counter:', pendingCounter);
      }
    } catch (e) {
      console.log('[getAgreementState] Counter error:', e.message);
    }

    return Response.json({
      success: true,
      agreement,
      latest_version: latestVersion,
      pending_counter: pendingCounter,
      deal_terms: deal.proposed_terms
    });
    
  } catch (error) {
    console.error('[getAgreementState] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});