import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ADMIN: Delete all pending counters without room_id (legacy scope)
 * This ensures counters are STRICTLY room-scoped going forward
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile || profile.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[cleanupLegacyCounters] Starting cleanup...');

    // Get all pending counters
    const allCounters = await base44.asServiceRole.entities.CounterOffer.filter({
      status: 'pending'
    });

    // Filter to those WITHOUT room_id (legacy scope)
    const legacyCounters = (allCounters || []).filter(c => !c.room_id);

    console.log(`[cleanupLegacyCounters] Found ${legacyCounters.length} legacy counters to delete`);

    // Delete each one
    const deletePromises = legacyCounters.map(counter =>
      base44.asServiceRole.entities.CounterOffer.delete(counter.id).catch(e => {
        console.error(`Failed to delete counter ${counter.id}:`, e.message);
      })
    );

    await Promise.all(deletePromises);

    console.log('[cleanupLegacyCounters] ✓ Cleanup complete');

    return Response.json({
      success: true,
      deleted_count: legacyCounters.length,
      message: `Deleted ${legacyCounters.length} legacy counters without room_id`
    });
  } catch (error) {
    console.error('[cleanupLegacyCounters] Fatal error:', error);
    return Response.json({
      error: error?.message || 'Cleanup failed'
    }, { status: 500 });
  }
});