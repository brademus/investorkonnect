import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// LITE CHECKOUT - CALLED VIA SDK (not direct URL)
Deno.serve(async (req) => {
  try {
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    
    if (!base) {
      return Response.json({ 
        ok: false, 
        reason: 'CONFIG_ERROR',
        message: 'Server configuration error' 
      }, { status: 500 });
    }

    console.log('=== Checkout Lite (SDK Call) ===');
    
    // Parse request body to get plan
    let plan = null;
    try {
      const body = await req.json();
      plan = body.plan;
      console.log('📦 Received plan from body:', plan);
    } catch (parseErr) {
      // Fallback to URL params for backward compatibility
      const url = new URL(req.url, base);
      plan = url.searchParams.get('plan');
      console.log('📦 Received plan from URL:', plan);
    }
    
    // Map plan to price ID
    const priceMap = {
      "starter": Deno.env.get('STRIPE_PRICE_STARTER'),
      "pro": Deno.env.get('STRIPE_PRICE_PRO'),
      "enterprise": Deno.env.get('STRIPE_PRICE_ENTERPRISE')
    };
    
    const price = plan ? priceMap[plan] : null;
    
    console.log('Plan:', plan, '→ Price:', price);
    
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      return Response.json({ 
        ok: false, 
        reason: 'CONFIG_ERROR',
        message: 'Stripe not configured' 
      }, { status: 500 });
    }
    
    if (!price || !price.startsWith('price_')) {
      return Response.json({ 
        ok: false, 
        reason: 'INVALID_PLAN',
        message: 'Invalid or missing plan' 
      }, { status: 400 });
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
    console.log('✅ Stripe URL:', session.url);
    
    // Return JSON with Stripe URL for client to redirect
    return Response.json({
      ok: true,
      url: session.url,
      session_id: session.id
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Checkout error:', error);
    return Response.json({ 
      ok: false, 
      reason: 'SERVER_ERROR',
      message: `Server error: ${error.message}` 
    }, { status: 500 });
  }
});