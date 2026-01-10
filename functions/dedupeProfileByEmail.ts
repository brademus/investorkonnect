import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * dedupeProfileByEmail
 * Deduplicate Profiles for a given email (defaults to caller's email).
 * Permissions: caller must be admin OR the email must match caller.email
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetEmail = (body.email || caller.email || '').toString().trim();
    if (!targetEmail) {
      return Response.json({ error: 'Missing email' }, { status: 400 });
    }
    const emailLower = targetEmail.toLowerCase();

    const isAdmin = caller.role === 'admin';
    const isSelf = (caller.email || '').toLowerCase() === emailLower;
    if (!isAdmin && !isSelf) {
      return Response.json({ error: 'Forbidden: admin or matching user only' }, { status: 403 });
    }

    // Find the User (if exists)
    const users = await base44.asServiceRole.entities.User.filter({ email: emailLower });
    const targetUser = users[0] || null;

    // Gather profiles by email and by user_id if we have user
    const byEmail = await base44.asServiceRole.entities.Profile.filter({ email: emailLower });
    const byUser = targetUser ? await base44.asServiceRole.entities.Profile.filter({ user_id: targetUser.id }) : [];

    // Merge unique profiles
    const map = new Map();
    for (const p of [...byEmail, ...byUser]) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    let profiles = Array.from(map.values());

    if (profiles.length === 0) {
      return Response.json({ kept_id: null, deleted_ids: [], linked: [], total_prior: 0, note: 'No profiles found for email' });
    }

    // Link all found profiles to the targetUser if present
    const linked = [];
    if (targetUser) {
      for (const p of profiles) {
        if (p.user_id !== targetUser.id || (p.email || '').toLowerCase() !== emailLower) {
          try {
            await base44.asServiceRole.entities.Profile.update(p.id, { user_id: targetUser.id, email: emailLower });
            linked.push(p.id);
          } catch (_) {}
        }
      }
      profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: targetUser.id });
    }

    if (profiles.length <= 1) {
      const keep = profiles[0];
      return Response.json({ kept_id: keep?.id || null, deleted_ids: [], linked, total_prior: profiles.length });
    }

    // Sort to select the most complete/recent to keep
    profiles.sort((a, b) => {
      // Onboarding completed
      const aOn = Boolean(a.onboarding_completed_at) || a.onboarding_step === 'deep_complete' || a.onboarding_step === 'basic_complete' || Boolean(a.onboarding_version);
      const bOn = Boolean(b.onboarding_completed_at) || b.onboarding_step === 'deep_complete' || b.onboarding_step === 'basic_complete' || Boolean(b.onboarding_version);
      if (aOn && !bOn) return -1;
      if (!aOn && bOn) return 1;
      // NDA
      if (a.nda_accepted && !b.nda_accepted) return -1;
      if (!a.nda_accepted && b.nda_accepted) return 1;
      // KYC
      const aK = a.kyc_status === 'approved';
      const bK = b.kyc_status === 'approved';
      if (aK && !bK) return -1;
      if (!aK && bK) return 1;
      // Subscription
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

    // Normalize kept profile
    try {
      await base44.asServiceRole.entities.Profile.update(keep.id, { email: emailLower, user_id: targetUser?.id || keep.user_id });
    } catch (_) {}

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

    return Response.json({ kept_id: keep.id, deleted_ids: deletedIds, linked, total_prior: profiles.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});