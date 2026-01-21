import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
    if (!stripeSecret || !publishableKey) {
      return Response.json({ error: 'Stripe keys are not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    // Fetch current user's profile (optional, for metadata and record)
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = Array.isArray(profiles) ? profiles[0] : profiles?.data?.[0];

    const publicAppUrl = Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || '';

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      options: {
        document: {
          require_matching_selfie: true,
        },
      },
      metadata: {
        user_id: user.id,
        user_email: user.email || '',
        profile_id: profile?.id || '',
      },
      // For redirect fallback flows. Not required for modal, but safe to include.
      return_url: publicAppUrl ? `${publicAppUrl}/IdentityVerification` : undefined,
    });

    if (profile?.id) {
      await base44.entities.Profile.update(profile.id, {
        identity_status: 'pending',
        identity_session_id: session.id,
        kyc_status: 'pending',
      });
    }

    return Response.json({
      client_secret: session.client_secret,
      session_id: session.id,
      publishable_key: publishableKey,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});