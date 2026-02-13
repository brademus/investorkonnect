import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    // Get user profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles?.length) return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });

    const profile = profiles[0];

    // Fast exit if no subscription
    if (!profile.stripe_subscription_id) {
      return Response.json({ ok: true, subscription: null });
    }

    // Use direct fetch instead of Stripe SDK to avoid CPU time limit on cold start
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const resp = await fetch(
      `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}`,
      { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
    );

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('Stripe API error:', resp.status, errBody);
      return Response.json({ ok: false, error: 'Failed to retrieve subscription' }, { status: 502 });
    }

    const subscription = await resp.json();

    // Update local status (fire and forget)
    base44.asServiceRole.entities.Profile.update(profile.id, {
      subscription_status: subscription.status
    }).catch(() => {});

    return Response.json({ ok: true, subscription });
  } catch (error) {
    console.error('stripeValidate error:', error.message);
    return Response.json({ ok: false, error: error.message || 'Server error' }, { status: 500 });
  }
});