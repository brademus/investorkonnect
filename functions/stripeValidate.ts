import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const user = await base44.auth.me();
    console.log('🔍 stripeValidate for user:', user.email);
    
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
    }
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    
    // Get user profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0) {
      return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }
    
    const profile = profiles[0];
    
    // If no subscription ID, no active subscription
    if (!profile.stripe_subscription_id) {
      return Response.json({ ok: true, subscription: null });
    }
    
    // Retrieve subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    
    // Update local status
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      subscription_status: subscription.status
    });
    
    return Response.json({ ok: true, subscription });
    
  } catch (error) {
    console.error('❌ stripeValidate error:', error);
    return Response.json({ ok: false, error: error.message || 'Server error' }, { status: 500 });
  }
});