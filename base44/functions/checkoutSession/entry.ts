import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import Stripe from 'npm:stripe@14.11.0';

// PUBLIC FUNCTION - handles auth redirect internally
Deno.serve(async (req) => {
  try {
    // Get base URL (remove trailing slashes)
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    
    if (!base) {
      return Response.json({ 
        ok: false, 
        error: 'Server configuration error: PUBLIC_APP_URL not set'
      }, { status: 500 });
    }
    
    // Parse request body
    const { session_id } = await req.json();
    
    if (!session_id) {
      return Response.json({
        ok: false,
        error: 'Missing session_id'
      }, { status: 400 });
    }
    
    // Get Stripe key
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ 
        ok: false, 
        error: 'Stripe not configured'
      }, { status: 500 });
    }
    
    // Create Stripe client
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    
    // Initialize Base44 client
    const base44 = createClientFromRequest(req);
    
    // Auth check
    const isAuth = await base44.auth.isAuthenticated();
    
    if (!isAuth) {
      return Response.json({ 
        ok: false, 
        error: 'Not authenticated',
        redirect: `${base}/login`
      }, { status: 401 });
    }
    
    // Get user
    const user = await base44.auth.me();
    
    // Retrieve session with expanded subscription
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'customer']
    });
    
    if (!session) {
      return Response.json({
        ok: false,
        error: 'Session not found'
      }, { status: 404 });
    }
    
    // Get subscription details
    const subscription = session.subscription;
    const customer = session.customer;
    
    if (!subscription) {
      return Response.json({
        ok: false,
        error: 'No subscription found in session'
      }, { status: 400 });
    }
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    
    if (profiles.length === 0) {
      return Response.json({
        ok: false,
        error: 'Profile not found'
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    
    // Extract IDs safely
    const subscriptionId = typeof subscription === 'string' ? subscription : subscription.id;
    const subscriptionStatus = typeof subscription === 'string' ? 'active' : subscription.status;
    const customerId = typeof customer === 'string' ? customer : customer?.id;
    
    console.log('✅ Subscription activated:', {
      user_id: user.id,
      subscription_id: subscriptionId,
      status: subscriptionStatus,
      customer_id: customerId
    });
    
    // Update profile with Stripe info
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      stripe_subscription_id: subscriptionId,
      subscription_status: subscriptionStatus,
      stripe_customer_id: customerId || profile.stripe_customer_id
    });
    
    return Response.json({
      ok: true,
      subscription: {
        id: subscriptionId,
        status: subscriptionStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Checkout session validation error:', error);
    return Response.json({
      ok: false,
      error: error.message || 'Server error validating session'
    }, { status: 500 });
  }
});