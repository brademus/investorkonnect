import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// SYNC SUBSCRIPTION FROM STRIPE
// Called from success page after checkout to ensure DB is up-to-date

Deno.serve(async (req) => {
  try {
    console.log('=== Sync Subscription ===');
    
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ 
        ok: false, 
        message: 'Stripe not configured' 
      }, { status: 500 });
    }
    
    // Parse request body
    const body = await req.json();
    const sessionId = body.session_id;
    
    if (!sessionId) {
      return Response.json({ 
        ok: false, 
        message: 'Missing session_id' 
      }, { status: 400 });
    }
    
    console.log('📦 Session ID:', sessionId);
    
    // Get authenticated user
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('👤 User:', user.email);
    
    // Get user's profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0) {
      return Response.json({ 
        ok: false, 
        message: 'Profile not found' 
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    console.log('📋 Profile found:', profile.email);
    
    // Retrieve checkout session from Stripe
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('💳 Session retrieved:', {
      id: session.id,
      mode: session.mode,
      status: session.payment_status,
      subscription: session.subscription
    });
    
    // Only handle subscription checkouts
    if (session.mode !== 'subscription' || !session.subscription) {
      return Response.json({ 
        ok: false, 
        message: 'Not a subscription checkout' 
      }, { status: 400 });
    }
    
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    console.log('📋 Subscription details:', {
      id: subscription.id,
      status: subscription.status,
      customer: subscription.customer,
      items: subscription.items.data.length
    });
    
    // Map price ID to plan
    const PRICE_TO_PLAN = {
      [Deno.env.get('STRIPE_PRICE_STARTER')]: 'starter',
      [Deno.env.get('STRIPE_PRICE_PRO')]: 'pro',
      [Deno.env.get('STRIPE_PRICE_ENTERPRISE')]: 'enterprise',
    };
    
    const priceId = subscription.items.data[0]?.price?.id;
    const plan = PRICE_TO_PLAN[priceId] || 'unknown';
    
    console.log('💳 Mapped plan:', { priceId, plan });
    
    // Update profile with subscription info
    await base44.entities.Profile.update(profile.id, {
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      subscription_tier: plan,
      subscription_status: subscription.status,
      subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    });
    
    console.log('✅ Profile updated successfully:', {
      email: profile.email,
      tier: plan,
      status: subscription.status
    });
    
    return Response.json({
      ok: true,
      plan: plan,
      status: subscription.status,
      message: 'Subscription synced successfully'
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ Sync error:', error);
    return Response.json({ 
      ok: false, 
      message: error.message 
    }, { status: 500 });
  }
});