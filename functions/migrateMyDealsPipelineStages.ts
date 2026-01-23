import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * One-time migration to normalize pipeline stages for current user's deals
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const userRole = profile.user_role || profile.role;

    // Legacy stage mapping
    const LEGACY_MAP = {
      'new_deal_under_contract': 'new_listings',
      'active_deal': 'active_listings',
      'closing': 'ready_to_close',
      'cancelled': 'canceled',
      'new_contract': 'new_listings',
      'under_contract': 'new_listings',
      'active': 'active_listings',
      'ready_to_close': 'ready_to_close',
      'closed': 'ready_to_close',
      'canceled': 'canceled'
    };

    // Get user's deals
    const filterKey = userRole === 'agent' 
      ? { agent_id: profile.id } 
      : { investor_id: profile.id };
    
    const deals = await base44.asServiceRole.entities.Deal.filter(filterKey);

    let migratedCount = 0;
    const updates = [];

    for (const deal of deals) {
      const currentStage = deal.pipeline_stage;
      const normalizedStage = LEGACY_MAP[currentStage] || currentStage || 'new_listings';
      
      // Only update if changed
      if (currentStage !== normalizedStage) {
        await base44.asServiceRole.entities.Deal.update(deal.id, {
          pipeline_stage: normalizedStage
        });
        migratedCount++;
        updates.push({
          dealId: deal.id,
          from: currentStage,
          to: normalizedStage
        });
      }
    }

    return Response.json({ 
      success: true,
      migrated_count: migratedCount,
      total_deals: deals.length,
      updates 
    });

  } catch (error) {
    console.error('migrateMyDealsPipelineStages error:', error);
    return Response.json({ 
      error: error.message || 'Migration failed' 
    }, { status: 500 });
  }
});