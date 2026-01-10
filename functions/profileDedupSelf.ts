import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ensureProfile } from './ensureProfile.js';

/**
 * profileDedupSelf
 * Deduplicate ONLY the current user's Profile records.
 * - Auth required (runs under the end-user session)
 * - Keeps the most complete/recent profile
 * - Deletes other duplicates and logs to AuditLog
 * - Links orphaned profiles (matching email) to the user_id before dedup
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailLower = (user.email || '').toLowerCase().trim();

    // Collect all candidate profiles for this user (by email and by user_id)
    const byEmail = await base44.asServiceRole.entities.Profile.filter({ email: emailLower });
    const byUser = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });

    // Merge unique by id
    const map = new Map();
    for (const p of [...byEmail, ...byUser]) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    const profiles = Array.from(map.values());

    // If nothing exists, ensure one exists then return
    if (profiles.length === 0) {
      const ensured = await ensureProfile(base44, user);
      return Response.json({ kept_id: ensured.id, deleted_ids: [], ensured: true });
    }

    // Link orphaned profiles (missing/invalid user_id) that match email
    const linked = [];
    for (const p of profiles) {
      if (!p.user_id || p.user_id !== user.id) {
        if ((p.email || '').toLowerCase() === emailLower) {
          try {
            await base44.asServiceRole.entities.Profile.update(p.id, { user_id: user.id });
            linked.push(p.id);
          } catch (e) {
            // continue; linking is best-effort
          }
        }
      }
    }

    // Refresh after linking
    const current = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    if (current.length <= 1) {
      // Nothing to dedup
      const keep = current[0] || profiles[0];
      return Response.json({ kept_id: keep?.id, deleted_ids: [], linked, ensured: false });
    }

    // Rank to choose the best profile to keep
    current.sort((a, b) => {
      // Prefer onboarding_completed_at
      if (a.onboarding_completed_at && !b.onboarding_completed_at) return -1;
      if (!a.onboarding_completed_at && b.onboarding_completed_at) return 1;
      // Prefer NDA accepted
      if (a.nda_accepted && !b.nda_accepted) return -1;
      if (!a.nda_accepted && b.nda_accepted) return 1;
      // Prefer subscription active/trialing
      const aSub = a.subscription_status === 'active' || a.subscription_status === 'trialing';
      const bSub = b.subscription_status === 'active' || b.subscription_status === 'trialing';
      if (aSub && !bSub) return -1;
      if (!aSub && bSub) return 1;
      // Prefer most recently updated
      const aTime = new Date(a.updated_date || a.created_date).getTime();
      const bTime = new Date(b.updated_date || b.created_date).getTime();
      return bTime - aTime;
    });

    const keep = current[0];
    const deletedIds = [];

    // Delete the rest, logging to AuditLog
    for (let i = 1; i < current.length; i++) {
      const dup = current[i];
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          actor_id: user.id,
          actor_name: user.email,
          entity_type: 'Profile',
          entity_id: dup.id,
          action: 'delete_duplicate_self',
          details: `Self-dedup: kept ${keep.id}, deleted duplicate ${dup.id} for user ${user.id}`,
          timestamp: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.Profile.delete(dup.id);
        deletedIds.push(dup.id);
      } catch (e) {
        // If delete fails, continue processing others
      }
    }

    return Response.json({ kept_id: keep.id, deleted_ids: deletedIds, linked, ensured: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});