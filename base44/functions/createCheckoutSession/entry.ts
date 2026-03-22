import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import Stripe from 'npm:stripe@14.11.0';

// Legacy function - kept for backward compatibility
Deno.serve(async (req) => {
  try {
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    
    if (!base) {
      return Response.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
    }
    
    const base44 = createClientFromRequest(req);
    const isAuth = await base44.auth.isAuthenticated();
    
    if (!isAuth) {
      return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const user = await base44.auth.me();
    const { plan } = await req.json();
    
    // Price map (same as checkoutLite)
    const priceMap = {
      "starter": "price_1SP89V1Nw95Lp8qMNv6ZlA6q" || Deno.env.get('STRIPE_PRICE_STARTER'),
      "pro": "price_1SP8AB1Nw95Lp8qMSu9CdqJk" || Deno.env.get('STRIPE_PRICE_PRO'),
      "enterprise": "price_1SP8B01Nw95Lp8qMsNzWobkZ" || Deno.env.get('STRIPE_PRICE_ENTERPRISE')
    };
    
    const price = plan ? priceMap[plan] : null;
    if (!price) {
      return Response.json({ ok: false, error: 'Invalid plan' }, { status: 400 });
    }
    
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
    }
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    
    const success = `${base}/BillingSuccess?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = `${base}/pricing?cancelled=true`;
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14,
        metadata: { user_id: user.id, plan }
      },
      metadata: { user_id: user.id, plan }
    });
    
    return Response.json({ ok: true, url: session.url, session_id: session.id });
    
  } catch (error) {
    console.error('❌ createCheckoutSession error:', error);
    return Response.json({ ok: false, error: error.message || 'Server error' }, { status: 500 });
  }
});