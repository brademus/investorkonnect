import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    
    // Parse request body to get plan + force_new
    let plan = null;
    let forceNew = false;
    try {
      const body = await req.json();
      plan = body.plan;
      forceNew = body.force_new === true;
      console.log('📦 Received plan from body:', plan);
      console.log('🔄 Force new:', forceNew);
    } catch (parseErr) {
      // Fallback to URL params for backward compatibility
      const url = new URL(req.url, base);
      plan = url.searchParams.get('plan');
      forceNew = url.searchParams.get('force_new') === '1';
      console.log('📦 Received plan from URL:', plan);
    }
    
    // Map plan to price ID
    const priceMap = {
      "starter": Deno.env.get('STRIPE_PRICE_STARTER'),
      "pro": Deno.env.get('STRIPE_PRICE_PRO'),
      "enterprise": Deno.env.get('STRIPE_PRICE_ENTERPRISE')
    };
    
    const price = plan ? priceMap[plan] : null;
    const stripeMode = Deno.env.get('STRIPE_MODE') || 'test';
    const isTestMode = stripeMode === 'test';
    
    console.log('Plan:', plan, '→ Price:', price);
    console.log('Stripe Mode:', stripeMode);
    
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

    // COMPREHENSIVE GATE: Check auth + onboarding
    const enableGating = (Deno.env.get('ENABLE_SUBSCRIPTION_GATING') || 'true') !== 'false';
    
    let userId = null;
    let userEmail = null;
    
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
        userId = user.id;
        userEmail = user.email;
        console.log('✅ User authenticated:', userEmail);
        
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        
        // Use profile email if it exists (more reliable than auth layer)
        if (profiles.length > 0 && profiles[0].email) {
          userEmail = profiles[0].email;
          console.log('✅ Using profile email:', userEmail);
        }
        
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
          nda_accepted: profile.nda_accepted
        });
        
        // Check if onboarded
        const hasLegacyProfile = !!(profile?.full_name && profile?.phone && (profile?.company || profile?.investor?.company_name));
        const onboarded = !!(profile?.onboarding_completed_at || profile?.onboarding_step === 'basic_complete' || profile?.onboarding_step === 'deep_complete' || profile?.onboarding_version || hasLegacyProfile);
        
        if (!onboarded) {
          console.log('❌ Onboarding not completed');
          return Response.json({ 
            ok: false, 
            reason: 'ONBOARDING_REQUIRED',
            message: 'Please complete your profile first',
            redirect: `${base}/onboarding`
          }, { status: 403 });
        }
        
        console.log('✅ User onboarded, proceeding with checkout');
        
      } catch (gateError) {
        console.error('❌ Gating check failed:', gateError);
        return Response.json({ 
          ok: false, 
          reason: 'GATE_ERROR',
          message: 'Failed to verify account status. Please try again.' 
        }, { status: 500 });
      }
    }

    // Success/cancel URLs
    const success = `${base}/BillingSuccess?session_id={CHECKOUT_SESSION_ID}`;
    const cancel = `${base}/pricing?cancelled=true`;
    
    console.log('Success URL:', success);
    console.log('Cancel URL:', cancel);
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    
    // Create or get Stripe customer
    let customerId = null;
    
    if (userId && userEmail) {
      const base44 = createClientFromRequest(req);
      const emailLower = userEmail.toLowerCase().trim();
      
      console.log('🔄 Looking up profile by email:', emailLower);
      
      // Always fetch fresh from DB to get latest stripe_customer_id
      let profiles = await base44.asServiceRole.entities.Profile.filter({ email: emailLower });
      
      // Fallback to user_id lookup if email lookup fails
      if (!profiles || profiles.length === 0) {
        console.log('⚠️ Email lookup failed, trying user_id lookup:', userId);
        profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: userId });
      }
      
      if (profiles.length > 0) {
        const profile = profiles[0];
        console.log('📋 Profile found, stripe_customer_id:', profile.stripe_customer_id || 'none');

        if (profile.stripe_customer_id) {
          const existingCustomerId = profile.stripe_customer_id;
          console.log('🔍 Checking for active/trialing subscriptions on:', existingCustomerId);

          // Check both active AND trialing subscriptions
          const [activeResult, trialingResult] = await Promise.all([
            stripe.subscriptions.list({
              customer: existingCustomerId,
              status: 'active',
              limit: 1
            }),
            stripe.subscriptions.list({
              customer: existingCustomerId,
              status: 'trialing',
              limit: 1
            })
          ]);

          const hasSub = (activeResult.data.length > 0 || trialingResult.data.length > 0);

          console.log('📊 Subscription check:', {
            active: activeResult.data.length,
            trialing: trialingResult.data.length,
            hasSub
          });

          if (hasSub && !forceNew) {
            // Has subscription and NOT force_new -> open Billing Portal
            console.log('🎯 Opening Billing Portal for existing subscriber');

            const portalSession = await stripe.billingPortal.sessions.create({
              customer: existingCustomerId,
              return_url: `${base}/pricing`
            });

            return Response.json({
              ok: true,
              url: portalSession.url,
              kind: 'portal',
              has_subscription: true
            }, { status: 200 });
          }

          if (hasSub && forceNew && isTestMode) {
            // Test mode: force_new -> cancel existing subs
            console.log('🔄 TEST MODE: Cancelling existing subscriptions');

            const allSubs = [...activeResult.data, ...trialingResult.data];
            for (const sub of allSubs) {
              await stripe.subscriptions.cancel(sub.id);
              console.log('✅ Cancelled subscription:', sub.id);
            }
          }

          // Either no sub, or force_new in test mode -> proceed with checkout
          customerId = existingCustomerId;
          console.log('✅ Using existing Stripe customer:', customerId);

        } else {
          // Create new Stripe customer (no email needed)
          console.log('🆕 Creating new Stripe customer');
          try {
            const customer = await stripe.customers.create({
              metadata: {
                user_id: userId,
                app: 'agentvault'
              }
            });

            customerId = customer.id;
            console.log('✅ Created new Stripe customer:', customerId);

            // Save customer ID to profile
            await base44.asServiceRole.entities.Profile.update(profile.id, {
              stripe_customer_id: customerId
            });
            console.log('💾 Saved stripe_customer_id to profile');
          } catch (stripeErr) {
            console.error('❌ Stripe customer creation failed:', stripeErr);
            return Response.json({ 
              ok: false, 
              reason: 'STRIPE_ERROR',
              message: `Stripe error: ${stripeErr.message}` 
            }, { status: 500 });
          }
        }
      } else {
        console.log('⚠️ No profile found for user_id:', userId);
        return Response.json({ 
          ok: false, 
          reason: 'PROFILE_NOT_FOUND',
          message: 'Profile not found. Please complete setup first.',
          redirect: `${base}/role`
        }, { status: 403 });
      }
      }
    
    // Create checkout session
    const sessionParams: any = {
      mode: 'subscription',
      line_items: [{
        price: price,
        quantity: 1
      }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: userId || 'unknown',
          plan: plan
        }
      },
      metadata: {
        user_id: userId || 'unknown',
        plan: plan
      }
    };
    
    // Use customer ID (required)
    if (!customerId) {
      return Response.json({ 
        ok: false, 
        reason: 'NO_CUSTOMER_ID',
        message: 'Failed to create or retrieve Stripe customer. Please try again.' 
      }, { status: 500 });
    }
    
    sessionParams.customer = customerId;
    console.log('✅ Using Stripe customer ID:', customerId);
    
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log('✅ Stripe session created:', session.id);
    console.log('✅ Stripe URL:', session.url);
    
    // Return JSON with Stripe URL for client to redirect
    return Response.json({
      ok: true,
      url: session.url,
      kind: 'checkout',
      forced_new: forceNew && isTestMode
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