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
        console.log('🔍 DEBUG - User ID:', userId);
        console.log('🔍 DEBUG - User object:', JSON.stringify(user, null, 2));
        
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
          nda_accepted: profile.nda_accepted,
          kyc_status: profile.kyc_status
        });
        
        // Check if onboarded using same logic as Pipeline
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

    // All checks passed - create Stripe session
    // FIXED: Use /BillingSuccess (matches page filename) instead of /billing/success
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
      const profiles = await base44.asServiceRole.entities.Profile.filter({ email: emailLower });
      
      if (profiles.length > 0) {
        const profile = profiles[0];
        console.log('📋 Profile found, stripe_customer_id:', profile.stripe_customer_id || 'none');
        
        if (profile.stripe_customer_id) {
          // Check if existing customer has an active subscription
          const existingCustomerId = profile.stripe_customer_id;
          console.log('🔍 Checking for active subscriptions on:', existingCustomerId);
          
          const subscriptions = await stripe.subscriptions.list({
            customer: existingCustomerId,
            status: 'active'
          });
          
          if (subscriptions.data.length > 0) {
            console.log('⚠️  Customer already has active subscription');
            // Don't use a customer ID - let Stripe treat as independent checkout
            customerId = null;
            console.log('🔄 Using customer_email only (no customer ID) to avoid conflict');
          } else {
            customerId = existingCustomerId;
            console.log('✅ Using existing Stripe customer (no active subs):', customerId);
          }
        } else {
          // Create new Stripe customer
          console.log('🆕 Creating new Stripe customer for:', emailLower);
          const customer = await stripe.customers.create({
            email: emailLower,
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
        }
      } else {
        console.log('⚠️ No profile found for email:', emailLower);
      }
    }
    
    const sessionParams = {
      mode: 'subscription',
      line_items: [{
        price: price,
        quantity: 1
      }],
      success_url: success,
      cancel_url: cancel,
      allow_promotion_codes: true,
      customer_email: userEmail,
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
    
    // Use customer ID if available (locks in customer for existing subscriptions)
    if (customerId) {
      sessionParams.customer = customerId;
      console.log('✅ Using existing Stripe customer ID:', customerId);
    } else if (userEmail && userEmail.trim()) {
      // Only use customer_email for new customers
      sessionParams.customer_email = userEmail;
      console.log('✅ Pre-filling email for new customer:', userEmail);
    }
    
    const session = await stripe.checkout.sessions.create(sessionParams);

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