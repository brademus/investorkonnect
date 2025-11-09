import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// LITE CHECKOUT WITH COMPREHENSIVE GATING
Deno.serve(async (req) => {
  try {
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    
    if (!base) {
      return new Response('Set PUBLIC_APP_URL', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    console.log('=== Lite Checkout with Full Gating ===');
    console.log('Base URL:', base);
    
    const url = new URL(req.url, base);
    const plan = url.searchParams.get('plan');
    const priceParam = url.searchParams.get('price');
    
    // Map plan to price ID
    const priceMap = {
      "starter": Deno.env.get('STRIPE_PRICE_STARTER'),
      "pro": Deno.env.get('STRIPE_PRICE_PRO'),
      "enterprise": Deno.env.get('STRIPE_PRICE_ENTERPRISE')
    };
    
    const price = priceParam || (plan ? priceMap[plan] : null);
    
    console.log('Plan:', plan);
    console.log('Price:', price);
    
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return new Response('Missing STRIPE_SECRET_KEY', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    if (!price || !price.startsWith('price_')) {
      return new Response('Missing or invalid price', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // COMPREHENSIVE GATE: Check auth + onboarding + NDA + KYC
    const enableGating = Deno.env.get('ENABLE_SUBSCRIPTION_GATING') !== 'false';
    
    if (enableGating) {
      try {
        const base44 = createClientFromRequest(req);
        const isAuth = await base44.auth.isAuthenticated();
        
        if (!isAuth) {
          console.log('❌ User not authenticated');
          return Response.json({ 
            ok: false, 
            reason: 'AUTH_REQUIRED',
            message: 'Please sign in to continue' 
          }, { status: 401 });
        }
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user.email);
        
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        
        if (profiles.length === 0) {
          console.log('❌ No profile found');
          return Response.json({ 
            ok: false, 
            reason: 'PROFILE_REQUIRED',
            message: 'Profile not found. Please complete setup.',
            redirect: `${base}/role`
          }, { status: 403 });
        }
        
        const profile = profiles[0];
        console.log('📋 Profile check:', {
          user_role: profile.user_role,
          onboarding_completed_at: profile.onboarding_completed_at,
          nda_accepted: profile.nda_accepted,
          kyc_status: profile.kyc_status
        });
        
        // Check if investor role
        if (profile.user_role === 'investor') {
          // For investors, check FULL readiness
          
          // 1. Check onboarding
          if (!profile.onboarding_completed_at || !profile.user_role) {
            console.log('❌ Onboarding not completed');
            return Response.json({ 
              ok: false, 
              reason: 'ONBOARDING_REQUIRED',
              message: 'Please complete your investor profile first',
              redirect: `${base}/onboarding/investor`
            }, { status: 403 });
          }
          
          // 2. Check KYC
          if (profile.kyc_status !== 'approved') {
            console.log('❌ KYC not verified (status:', profile.kyc_status, ')');
            return Response.json({ 
              ok: false, 
              reason: 'VERIFICATION_REQUIRED',
              message: 'Please complete identity verification first',
              redirect: `${base}/verify`
            }, { status: 403 });
          }
          
          // 3. Check NDA
          if (!profile.nda_accepted) {
            console.log('❌ NDA not accepted');
            return Response.json({ 
              ok: false, 
              reason: 'NDA_REQUIRED',
              message: 'Please accept the NDA first',
              redirect: `${base}/nda`
            }, { status: 403 });
          }
          
          console.log('✅ Investor fully ready - all gates passed');
        } else {
          // For non-investors (agents, etc.), just check basic onboarding
          if (!profile.onboarding_completed_at) {
            console.log('❌ Basic onboarding not completed');
            return Response.json({ 
              ok: false, 
              reason: 'ONBOARDING_REQUIRED',
              message: 'Please complete onboarding before subscribing',
              redirect: `${base}/onboarding`
            }, { status: 403 });
          }
          
          console.log('✅ Non-investor user ready');
        }
        
      } catch (gateError) {
        console.error('❌ Gating check failed:', gateError);
        return Response.json({ 
          ok: false, 
          reason: 'GATE_ERROR',
          message: 'Failed to verify account status. Please try again.' 
        }, { status: 500 });
      }
    }

    // All checks passed - create Stripe session
    const success = `${base}/?payment=success`;
    const cancel = `${base}/pricing?cancelled=true`;
    
    console.log('Success URL:', success);
    console.log('Cancel URL:', cancel);
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price: price,
        quantity: 1
      }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14
      }
    });

    console.log('✅ Stripe session created:', session.id);
    console.log('✅ Redirecting to:', session.url);
    
    // FORCE REDIRECT with HTML
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting to Stripe...</title>
  <meta http-equiv="refresh" content="0;url=${session.url}">
  <script>
    // Try multiple redirect methods
    setTimeout(function() {
      if (window.top) {
        window.top.location.replace(${JSON.stringify(session.url)});
      } else {
        window.location.replace(${JSON.stringify(session.url)});
      }
    }, 100);
  </script>
  <style>
    body { 
      font-family: system-ui, sans-serif; 
      max-width: 500px; 
      margin: 100px auto; 
      text-align: center; 
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
    a {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
    a:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Opening Stripe Checkout...</p>
  <p style="color: #64748b; font-size: 14px; margin-top: 10px;">
    Starting your 14-day free trial
  </p>
  <a href="${session.url}">Click here if not redirected</a>
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
    return new Response(`Server error: ${error.message}`, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});