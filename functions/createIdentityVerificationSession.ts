import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.11.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles?.length) return Response.json({ error: 'Profile not found' }, { status: 404 });
    const profile = profiles[0];

    // Allow after subscription for investors; agents have no subscription step in this app
    const isInvestor = profile.user_role === 'investor' || profile.user_type === 'investor';
    if (isInvestor) {
      const subStatus = profile.subscription_status;
      if (!['active', 'trialing'].includes(subStatus)) {
        return Response.json({ error: 'Subscription required before identity verification' }, { status: 400 });
      }
    }

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) return Response.json({ error: 'Missing Stripe secret key' }, { status: 500 });

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const returnUrl = (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || '').replace(/\/$/, '') + '/PostAuth';

    // Create redirect-based Identity Verification Session
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      return_url: returnUrl,
      metadata: { userId: user.id, profileId: profile.id, role: profile.user_role || profile.user_type || 'member' },
      client_reference_id: user.id
    });

    // Upsert identity record
    const existing = await base44.entities.UserIdentity.filter({ user_id: user.id });
    const payload = {
      user_id: user.id,
      profile_id: profile.id,
      provider: 'stripe',
      verificationSessionId: session.id,
      verificationStatus: 'REQUIRES_INPUT',
      verifiedAt: null,
      verifiedFirstName: null,
      verifiedLastName: null,
      nameMatchStatus: 'UNKNOWN',
      lastError: null
    };

    // if previously VERIFIED, keep verified fields and only update sessionId/status
    if (existing?.length && existing[0].verificationStatus === 'VERIFIED') {
      payload.verifiedAt = existing[0].verifiedAt;
      payload.verifiedFirstName = existing[0].verifiedFirstName;
      payload.verifiedLastName = existing[0].verifiedLastName;
      payload.nameMatchStatus = existing[0].nameMatchStatus || 'MATCH';
    }
    if (existing?.length) {
      await base44.entities.UserIdentity.update(existing[0].id, payload);
    } else {
      await base44.entities.UserIdentity.create(payload);
    }

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});