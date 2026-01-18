import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0] || null;

    const recs = await base44.entities.UserIdentity.filter({ user_id: user.id });
    const rawIdentity = recs?.[0] || {
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

    // In test mode, force name to be treated as MATCH and use onboarding names for display
    const isStripeTestMode = () => {
      const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
      const mode = (Deno.env.get('STRIPE_MODE') || '').toLowerCase();
      return key.startsWith('sk_test_') || mode === 'test' || profile?.identity_mode === 'test';
    };

    const identity = { ...rawIdentity };
    if (identity.verificationStatus === 'VERIFIED' && isStripeTestMode()) {
      const first = profile?.verified_first_name || profile?.onboarding_first_name || (profile?.full_name?.split(' ')[0] || null);
      const last = profile?.verified_last_name || profile?.onboarding_last_name || (profile?.full_name?.split(' ').slice(1).join(' ') || null);
      identity.verifiedFirstName = first;
      identity.verifiedLastName = last;
      identity.nameMatchStatus = 'MATCH';
    }

    return Response.json({ identity, profile: profile ? { id: profile.id, full_name: profile.full_name, subscription_status: profile.subscription_status, user_role: profile.user_role } : null });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});