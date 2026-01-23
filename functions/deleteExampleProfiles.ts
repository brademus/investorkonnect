import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin-only utility: Delete all example/demo Profile records.
 *
 * Criteria (email lowercase check):
 * - endsWith('@example.com')
 * - endsWith('@investorkonnect.demo')
 *
 * NOTE: This only deletes Profile records, not related deals/rooms.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin guard (either auth.user.role or Profile.role/user_role)
    let isAdmin = user.role === 'admin';
    if (!isAdmin) {
      try {
        const myProfiles = await base44.entities.Profile.filter({ user_id: user.id });
        const myProfile = myProfiles?.[0];
        if (myProfile) {
          isAdmin = myProfile.role === 'admin' || myProfile.user_role === 'admin';
        }
      } catch (_) {}
    }
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch a broad batch of profiles (filtering done client-side for endsWith)
    const limit = 5000; // generous batch
    const allProfiles = await base44.asServiceRole.entities.Profile.filter({}, undefined, limit);

    const matches = [];
    for (const p of allProfiles || []) {
      const email = (p?.email || '').toLowerCase().trim();
      if (email.endsWith('@example.com') || email.endsWith('@investorkonnect.demo')) {
        matches.push(p);
      }
    }

    let deleted = 0;
    for (const p of matches) {
      await base44.asServiceRole.entities.Profile.delete(p.id);
      deleted += 1;
    }

    return Response.json({
      success: true,
      scanned: allProfiles?.length || 0,
      matched: matches.length,
      deleted,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});