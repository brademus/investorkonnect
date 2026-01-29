import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
    }
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const base44 = createClientFromRequest(req);
    
    const { subscription_id } = await req.json();
    if (!subscription_id) {
      return Response.json({ ok: false, error: 'Missing subscription_id' }, { status: 400 });
    }
    
    const subscription = await stripe.subscriptions.retrieve(subscription_id);
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    
    // Find profile by customer ID
    const profiles = await base44.entities.Profile.filter({ stripe_customer_id: customerId });
    if (profiles.length === 0) {
      return Response.json({ ok: false, error: 'Profile not found for customer' }, { status: 404 });
    }
    
    const profile = profiles[0];
    
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status
    });
    
    return Response.json({ ok: true });
    
  } catch (error) {
    console.error('❌ syncSubscription error:', error);
    return Response.json({ ok: false, error: error.message || 'Server error' }, { status: 500 });
  }
});