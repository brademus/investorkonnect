import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { ensureProfile } from './ensureProfile.js';

/**
 * fixProfileForEmail
 * Admin or self-serve tool to deduplicate Profiles for a specific email.
 * - Input: { email: string }
 * - Keeps the most complete/recent profile and deletes the rest
 * - Ensures the kept profile is linked to the correct User (by email)
 * - Safe to run multiple times
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const emailInput = (body.email || '').toString().trim();
    if (!emailInput) {
      return Response.json({ error: 'Missing email' }, { status: 400 });
    }
    const emailLower = emailInput.toLowerCase();

    // Allow if admin or it's the caller's own email
    const isAdmin = caller.role === 'admin';
    const isSelf = (caller.email || '').toLowerCase() === emailLower;
    if (!isAdmin && !isSelf) {
      return Response.json({ error: 'Forbidden: admin or matching user only' }, { status: 403 });
    }

    // Locate the User for this email (if exists)
    const users = await base44.asServiceRole.entities.User.filter({ email: emailLower });
    const targetUser = users[0] || null;

    // Gather candidate profiles by email and (if user found) by user_id
    const byEmail = await base44.asServiceRole.entities.Profile.filter({ email: emailLower });
    const byUser = targetUser ? await base44.asServiceRole.entities.Profile.filter({ user_id: targetUser.id }) : [];

    const map = new Map();
    for (const p of [...byEmail, ...byUser]) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    let profiles = Array.from(map.values());

    // If none exist but a user exists, ensure one
    if (profiles.length === 0 && targetUser) {
      const ensured = await ensureProfile(base44, targetUser);
      return Response.json({ ensured: true, kept_id: ensured.id, deleted_ids: [], linked: [], total_prior: 0 });
    }

    // If still none and no user, nothing to do
    if (profiles.length === 0) {
      return Response.json({ ensured: false, kept_id: null, deleted_ids: [], linked: [], total_prior: 0, note: 'No profiles or user found for email' });
    }

    // Link orphaned profiles to the user if we have the user
    const linked = [];
    if (targetUser) {
      for (const p of profiles) {
        if (p.user_id !== targetUser.id) {
          try {
            await base44.asServiceRole.entities.Profile.update(p.id, { user_id: targetUser.id, email: emailLower });
            linked.push(p.id);
          } catch (_) {}
        }
      }
      // Refresh list by user_id now
      profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: targetUser.id });
    }

    if (profiles.length <= 1) {
      const keep = profiles[0];
      return Response.json({ ensured: false, kept_id: keep?.id || null, deleted_ids: [], linked, total_prior: profiles.length });
    }

    // Sort to pick best profile to keep
    profiles.sort((a, b) => {
      // Prefer onboarding completed
      if (a.onboarding_completed_at && !b.onboarding_completed_at) return -1;
      if (!a.onboarding_completed_at && b.onboarding_completed_at) return 1;
      // Prefer NDA accepted
      if (a.nda_accepted && !b.nda_accepted) return -1;
      if (!a.nda_accepted && b.nda_accepted) return 1;
      // Prefer KYC approved
      const aK = a.kyc_status === 'approved';
      const bK = b.kyc_status === 'approved';
      if (aK && !bK) return -1;
      if (!aK && bK) return 1;
      // Prefer subscription active/trialing
      const aSub = a.subscription_status === 'active' || a.subscription_status === 'trialing';
      const bSub = b.subscription_status === 'active' || b.subscription_status === 'trialing';
      if (aSub && !bSub) return -1;
      if (!aSub && bSub) return 1;
      // Most recently updated
      const aTime = new Date(a.updated_date || a.created_date).getTime();
      const bTime = new Date(b.updated_date || b.created_date).getTime();
      return bTime - aTime;
    });

    const keep = profiles[0];
    const toDelete = profiles.slice(1);

    // Normalize kept profile fields
    if (targetUser) {
      try {
        await base44.asServiceRole.entities.Profile.update(keep.id, { user_id: targetUser.id, email: emailLower });
      } catch (_) {}
    } else {
      try {
        await base44.asServiceRole.entities.Profile.update(keep.id, { email: emailLower });
      } catch (_) {}
    }

    const deletedIds = [];
    for (const dup of toDelete) {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          actor_id: caller.id,
          actor_name: caller.email,
          entity_type: 'Profile',
          entity_id: dup.id,
          action: 'delete_duplicate_by_email',
          details: `Kept ${keep.id} for ${emailLower}; deleted ${dup.id}`,
          timestamp: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.Profile.delete(dup.id);
        deletedIds.push(dup.id);
      } catch (_) {}
    }

    return Response.json({ ensured: false, kept_id: keep.id, deleted_ids: deletedIds, linked, total_prior: profiles.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});