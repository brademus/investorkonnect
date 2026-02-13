import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    console.log('stripeValidate for user:', user.email);

    // Get user profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles?.length) return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });

    const profile = profiles[0];

    // If no subscription ID, no active subscription - fast exit, no Stripe import needed
    if (!profile.stripe_subscription_id) {
      return Response.json({ ok: true, subscription: null });
    }

    // Only import Stripe when we actually need it (lazy import reduces cold start CPU)
    const { default: Stripe } = await import('npm:stripe@14.25.0');
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), { apiVersion: '2023-10-16' });

    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

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