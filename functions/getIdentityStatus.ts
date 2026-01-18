import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0] || null;

    const recs = await base44.entities.UserIdentity.filter({ user_id: user.id });
    const identity = recs?.[0] || {
      user_id: user.id,
      profile_id: profile?.id || null,
      provider: 'stripe',
      verificationSessionId: null,
      verificationStatus: 'NOT_STARTED',
      verifiedAt: null,
      verifiedFirstName: null,
      verifiedLastName: null,
      nameMatchStatus: 'UNKNOWN',
      lastError: null,
    };

    return Response.json({ identity, profile: profile ? { id: profile.id, full_name: profile.full_name, subscription_status: profile.subscription_status, user_role: profile.user_role } : null });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});