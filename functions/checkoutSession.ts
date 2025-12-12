import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import Stripe from 'npm:stripe@14.11.0';

// PUBLIC FUNCTION - handles auth redirect internally
Deno.serve(async (req) => {
  try {
    // Get base URL (remove trailing slashes)
    const url = new URL(req.url);
    const host = url.host || 'agent-vault-da3d088b.base44.app';
    const base = (Deno.env.get('PUBLIC_APP_URL') || `https://${host}`).replace(/\/+$/, '');
    
    // Parse parameters
    const plan = url.searchParams.get('plan');
    const priceParam = url.searchParams.get('price');
    
    console.log('=== Checkout Session Request ===');
    console.log('Base URL:', base);
    console.log('Plan:', plan);
    console.log('Price param:', priceParam);
    
    // Map plan to price ID
    const priceMap = {
      "starter": Deno.env.get('STRIPE_PRICE_STARTER'),
      "pro": Deno.env.get('STRIPE_PRICE_PRO'),
      "enterprise": Deno.env.get('STRIPE_PRICE_ENTERPRISE')
    };
    
    const price = priceParam || (plan ? priceMap[plan] : null);
    console.log('Resolved price:', price);

    // ---- AUTH CHECK (self-handled; route is PUBLIC) ----
    const mustAuth = Deno.env.get('REQUIRE_AUTH_FOR_CHECKOUT') !== 'false';
    console.log('Auth required:', mustAuth);
    
    let user = null;
    if (mustAuth) {
      try {
        const base44 = createClientFromRequest(req);
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          user = await base44.auth.me();
          console.log('✅ User authenticated:', user.email);
        }
      } catch (e) {
        console.log('ℹ️ User not authenticated');
      }
    }

    // If auth required and no user -> redirect to login with HTML redirect page
    if (mustAuth && !user) {
      const next = encodeURIComponent(`/functions/checkoutSession${url.search}`);
      const loginUrl = `${base}/onboarding?next=${next}`;
      
      console.log('🔄 Redirecting to login:', loginUrl);
      
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting to Login...</title>
  <meta http-equiv="refresh" content="0;url=${loginUrl}">
  <script>top.location.replace(${JSON.stringify(loginUrl)});</script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <p>Redirecting to login...</p>
  <p><a href="${loginUrl}">Click here if not redirected automatically</a></p>
</body>
</html>`;
      
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Location': loginUrl
        }
      });
    }
    // --------------------------------------------------------

    // Validate environment
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY missing');
      return new Response('Missing STRIPE_SECRET_KEY', { status: 500 });
    }
    
    if (!price || !price.startsWith('price_')) {
      console.error('❌ Invalid or missing price:', price);
      return new Response('Missing or invalid price', { status: 400 });
    }

    // Initialize Stripe
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    
    // If user is authenticated, get/create profile and customer
    let customerId = null;
    if (user) {
      const base44 = createClientFromRequest(req);
      const profiles = await base44.entities.Profile.filter({ email: user.email });
      
      if (profiles.length === 0 || !profiles[0].onboarded) {
        console.log('⚠️ User not onboarded, redirecting');
        const redirectUrl = `${base}/onboarding?next=${encodeURIComponent(url.pathname + url.search)}`;
        
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Complete Your Profile...</title>
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>top.location.replace(${JSON.stringify(redirectUrl)});</script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 100px auto; text-align: center; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <p>Please complete your profile first...</p>
  <p><a href="${redirectUrl}">Click here if not redirected automatically</a></p>
</body>
</html>`;
        
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      
      const profile = profiles[0];
      console.log('✅ Profile found:', profile.id);

      // Get or create Stripe customer
      customerId = profile.stripe_customer_id;
      if (!customerId) {
        console.log('📝 Creating Stripe customer');
        const customer = await stripe.customers.create({
          email: user.email,
          name: profile.full_name || user.full_name || 'AgentVault User',
          metadata: {
            profile_id: profile.id,
            user_email: user.email,
            plan: plan || 'unknown'
          }
        });
        customerId = customer.id;
        await base44.entities.Profile.update(profile.id, {
          stripe_customer_id: customerId
        });
        console.log('✅ Customer created:', customerId);
      } else {
        console.log('✅ Using existing customer:', customerId);
      }
    }

    // Create checkout session
    const success = `${base}/account/billing?success=true`;
    const cancel = `${base}/pricing?cancelled=true`;
    
    console.log('✅ Creating checkout session');
    
    const sessionParams = {
      mode: 'subscription',
      line_items: [{
        price: price,
        quantity: 1
      }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true
    };
    
    // Add customer if we have one
    if (customerId) {
      sessionParams.customer = customerId;
      sessionParams.metadata = {
        profile_id: profiles[0].id,
        user_email: user.email,
        plan: plan || 'unknown'
      };
    }
    
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log('✅ Redirecting to Stripe:', session.url);
    
    // FORCE the redirect with HTML page
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Opening Stripe Checkout...</title>
  <meta http-equiv="refresh" content="0;url=${session.url}">
  <script>top.location.replace(${JSON.stringify(session.url)});</script>
  <style>
    body { 
      font-family: system-ui, sans-serif; 
      max-width: 500px; 
      margin: 100px auto; 
      text-align: center; 
    }
    a { 
      color: #2563eb; 
      text-decoration: none; 
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      border-radius: 8px;
      font-weight: 500;
    }
    a:hover { 
      background: #1d4ed8;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #2563eb;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Opening Stripe Checkout...</p>
  <a href="${session.url}">Click here if not redirected automatically</a>
</body>
</html>`;
    
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Location': session.url
      }
    });

  } catch (error) {
    console.error('❌ Checkout error:', error);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
});