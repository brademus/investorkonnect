import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// LITE CHECKOUT - Uses direct fetch to Stripe API (no heavy SDK import = no cold-start 502)
Deno.serve(async (req) => {
  try {
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    
    if (!base) {
      return Response.json({ ok: false, reason: 'CONFIG_ERROR', message: 'Server configuration error' }, { status: 500 });
    }

    console.log('=== Checkout Lite (SDK Call) ===');
    
    // Parse request body to get plan
    let plan = null;
    try {
      const body = await req.json();
      plan = body.plan;
    } catch (_) {}
    
    const price = Deno.env.get('STRIPE_PRICE_MEMBERSHIP');
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ ok: false, reason: 'CONFIG_ERROR', message: 'Stripe not configured' }, { status: 500 });
    }
    
    if (!price || !price.startsWith('price_')) {
      return Response.json({ ok: false, reason: 'INVALID_PLAN', message: 'Invalid or missing plan' }, { status: 400 });
    }

    // Auth check
    const base44 = createClientFromRequest(req);
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      return Response.json({ ok: false, reason: 'AUTH_REQUIRED', message: 'Please sign in to continue' }, { status: 401 });
    }
    
    const user = await base44.auth.me();
    const userId = user.id;
    console.log('✅ User authenticated:', userId);

    // Helper for Stripe API calls via fetch
    const stripeApi = async (endpoint, params) => {
      const resp = await fetch(`https://api.stripe.com/v1${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || `Stripe API error ${resp.status}`);
      return data;
    };

    const stripeGet = async (endpoint) => {
      const resp = await fetch(`https://api.stripe.com/v1${endpoint}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
      });
      return resp;
    };
    
    // OPTIONAL GATE: Check onboarding
    const enableGating = Deno.env.get('ENABLE_SUBSCRIPTION_GATING') !== 'false';
    
    if (enableGating) {
      try {
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        
        if (profiles.length === 0) {
          return Response.json({ ok: false, reason: 'PROFILE_REQUIRED', message: 'Profile not found. Please complete setup.', redirect: `${base}/role` }, { status: 403 });
        }
        
        const profile = profiles[0];
        
        if (!profile.onboarding_completed_at) {
          const redirectPath = profile.user_role === 'agent' ? `${base}/AgentOnboarding` : `${base}/InvestorOnboarding`;
          return Response.json({ ok: false, reason: 'ONBOARDING_REQUIRED', message: 'Please complete your profile first', redirect: redirectPath }, { status: 403 });
        }
        
        console.log('✅ User ready:', profile.user_role);
      } catch (gateError) {
        console.error('❌ Gating check failed:', gateError);
        return Response.json({ ok: false, reason: 'GATE_ERROR', message: 'Failed to verify account status. Please try again.' }, { status: 500 });
      }
    }

    // Get or create Stripe customer
    const profiles = await base44.entities.Profile.filter({ user_id: userId });
    if (profiles.length === 0) {
      return Response.json({ ok: false, reason: 'PROFILE_ERROR', message: 'Profile not found' }, { status: 404 });
    }
    
    const profile = profiles[0];
    let customerId = profile.stripe_customer_id || null;

    if (!customerId) {
      // Create new Stripe customer via fetch
      const customer = await stripeApi('/customers', {
        'metadata[user_id]': userId,
        'metadata[app]': 'agentvault',
      });
      customerId = customer.id;
      console.log('✅ Created new Stripe customer:', customerId);
      
      await base44.asServiceRole.entities.Profile.update(profile.id, { stripe_customer_id: customerId });
    } else {
      console.log('✅ Using existing Stripe customer:', customerId);
    }

    // Create checkout session via fetch
    const success = `${base}/BillingSuccess?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = `${base}/pricing?cancelled=true`;

    const session = await stripeApi('/checkout/sessions', {
      'mode': 'subscription',
      'customer': customerId,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      'success_url': success,
      'cancel_url': cancel,
      'allow_promotion_codes': 'true',
      'subscription_data[metadata][user_id]': userId || 'unknown',
      'subscription_data[metadata][plan]': 'membership',
      'metadata[user_id]': userId || 'unknown',
      'metadata[plan]': 'membership',
    });

    console.log('✅ Stripe session created:', session.id);
    
    return Response.json({ ok: true, url: session.url, session_id: session.id }, { status: 200 });

  } catch (error) {
    console.error('❌ Checkout error:', error);
    return Response.json({ ok: false, reason: 'SERVER_ERROR', message: `Server error: ${error.message}` }, { status: 500 });
  }
});