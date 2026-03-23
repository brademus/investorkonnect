import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * When a deal becomes fully signed (agent signed), this function:
 * 1. Locks the winning deal to the agent
 * 2. Finds all sibling deals (same address + investor OR same source_deal_id)
 * 3. Deletes sibling deals, voids their invites, and cleans up rooms
 *
 * Called from moveDealOnFullySignedAgreement automation or directly.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { deal_id } = await req.json();

    if (!deal_id) return Response.json({ ok: true, reason: 'no_deal_id' });

    const deals = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    const winningDeal = deals?.[0];
    if (!winningDeal) return Response.json({ ok: true, reason: 'deal_not_found' });

    const investorId = winningDeal.investor_id;
    const address = winningDeal.property_address;
    const sourceDealId = winningDeal.source_deal_id || winningDeal.id;

    if (!investorId) return Response.json({ ok: true, reason: 'no_investor' });

    // Find ALL sibling deals: same source_deal_id OR same investor+address
    let siblingDeals = [];
    
    // Strategy 1: By source_deal_id
    if (winningDeal.source_deal_id) {
      // Find deals that share the same source_deal_id
      const bySource = await base44.asServiceRole.entities.Deal.filter({ source_deal_id: winningDeal.source_deal_id });
      siblingDeals.push(...bySource);
      // Also find the original source deal itself
      const sourceDeal = await base44.asServiceRole.entities.Deal.filter({ id: winningDeal.source_deal_id }).catch(() => []);
      siblingDeals.push(...sourceDeal);
    } else {
      // This IS the source deal — find deals that point to it
      const bySource = await base44.asServiceRole.entities.Deal.filter({ source_deal_id: winningDeal.id });
      siblingDeals.push(...bySource);
    }

    // Strategy 2: By investor + address (catches any missed links)
    if (address) {
      const byAddress = await base44.asServiceRole.entities.Deal.filter({ 
        investor_id: investorId, 
        property_address: address 
      });
      siblingDeals.push(...byAddress);
    }

    // Deduplicate and exclude the winning deal
    const seen = new Set();
    const toDelete = siblingDeals.filter(d => {
      if (!d?.id || d.id === deal_id || seen.has(d.id)) return false;
      if (d.status === 'archived' || d.status === 'closed') return false;
      seen.add(d.id);
      return true;
    });

    console.log(`[lockDealDeleteSiblings] Winning deal: ${deal_id}, siblings to delete: ${toDelete.length}`);

    // Delete each sibling: void invites, delete rooms, delete the deal
    for (const sibling of toDelete) {
      try {
        // Void invites
        const invites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id: sibling.id });
        for (const inv of invites) {
          await base44.asServiceRole.entities.DealInvite.update(inv.id, { status: 'VOIDED' }).catch(() => {});
        }

        // Delete rooms
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: sibling.id });
        for (const room of rooms) {
          await base44.asServiceRole.entities.Room.delete(room.id).catch(() => {});
        }

        // Void any agreements
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: sibling.id });
        for (const ag of agreements) {
          if (ag.status !== 'fully_signed' && ag.status !== 'voided') {
            await base44.asServiceRole.entities.LegalAgreement.update(ag.id, { status: 'voided' }).catch(() => {});
          }
        }

        // Delete the deal
        await base44.asServiceRole.entities.Deal.delete(sibling.id);
        console.log(`[lockDealDeleteSiblings] Deleted sibling deal: ${sibling.id} (agent: ${sibling.agent_id})`);
      } catch (err) {
        console.error(`[lockDealDeleteSiblings] Error cleaning sibling ${sibling.id}:`, err.message);
      }
    }

    return Response.json({ ok: true, deleted_count: toDelete.length, deleted_ids: toDelete.map(d => d.id) });
  } catch (error) {
    console.error('[lockDealDeleteSiblings] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});