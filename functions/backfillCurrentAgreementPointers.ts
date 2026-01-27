import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * One-time data backfill to ensure deal.current_legal_agreement_id is populated.
 * Also migrates CounterOffer.terms to terms_delta for backwards compatibility.
 * 
 * Admin-only function. Run manually from functions dashboard.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only access
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('[Backfill] Starting migration...');
    const results = {
      deals_checked: 0,
      deals_updated: 0,
      counters_checked: 0,
      counters_updated: 0,
      errors: []
    };

    // === PART 1: Backfill deal.current_legal_agreement_id ===
    const allDeals = await base44.asServiceRole.entities.Deal.list('-created_date', 500);
    results.deals_checked = allDeals.length;

    for (const deal of allDeals) {
      try {
        // Skip if already set
        if (deal.current_legal_agreement_id) {
          console.log(`[Backfill] Deal ${deal.id} already has pointer, skipping`);
          continue;
        }

        // Find latest non-superseded LegalAgreement
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal.id }, '-created_date', 10);
        const activeAgreement = agreements?.find(a => a.status !== 'superseded' && a.status !== 'voided');

        if (activeAgreement) {
          await base44.asServiceRole.entities.Deal.update(deal.id, {
            current_legal_agreement_id: activeAgreement.id
          });
          console.log(`[Backfill] ✓ Deal ${deal.id} → LegalAgreement ${activeAgreement.id}`);
          results.deals_updated++;
        } else {
          console.log(`[Backfill] Deal ${deal.id} has no active LegalAgreement, skipping`);
        }
      } catch (error) {
        console.error(`[Backfill] Error updating deal ${deal.id}:`, error.message);
        results.errors.push({ deal_id: deal.id, error: error.message });
      }
    }

    // === PART 2: Migrate CounterOffer.terms → terms_delta ===
    const allCounters = await base44.asServiceRole.entities.CounterOffer.list('-created_date', 500);
    results.counters_checked = allCounters.length;

    for (const counter of allCounters) {
      try {
        // Skip if terms_delta already exists
        if (counter.terms_delta) {
          continue;
        }

        // If terms exists, copy to terms_delta
        if (counter.terms) {
          await base44.asServiceRole.entities.CounterOffer.update(counter.id, {
            terms_delta: counter.terms
          });
          console.log(`[Backfill] ✓ CounterOffer ${counter.id} migrated terms → terms_delta`);
          results.counters_updated++;
        }
      } catch (error) {
        console.error(`[Backfill] Error updating counter ${counter.id}:`, error.message);
        results.errors.push({ counter_id: counter.id, error: error.message });
      }
    }

    console.log('[Backfill] ✅ Migration complete:', results);

    return Response.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});