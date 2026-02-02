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

    // Create verification session with timeout protection
    let session;
    try {
      const sessionPromise = stripe.identity.verificationSessions.create({
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
        return_url: publicAppUrl ? `${publicAppUrl}/IdentityVerification` : undefined,
      });

      // Set a 20-second timeout for Stripe API call
      session = await Promise.race([
        sessionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Stripe API timeout')), 20000))
      ]);
    } catch (stripeError) {
      console.error('[createStripeIdentitySession] Stripe API error:', stripeError.message);
      return Response.json({ error: 'Failed to create verification session. Please try again.' }, { status: 502 });
    }

    // Update profile in background (don't wait for it, just fire and forget)
    if (profile?.id) {
      base44.entities.Profile.update(profile.id, {
        identity_status: 'pending',
        identity_session_id: session.id,
        kyc_status: 'pending',
      }).catch(err => console.error('[createStripeIdentitySession] Profile update failed:', err.message));
    }

    return Response.json({
      client_secret: session.client_secret,
      session_id: session.id,
      publishable_key: publishableKey,
    });
  } catch (error) {
    console.error('[createStripeIdentitySession] Unexpected error:', error.message);
    return Response.json({ error: 'Verification setup failed. Please try again.' }, { status: 500 });
  }
});