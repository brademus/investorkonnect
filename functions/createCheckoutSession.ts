import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      console.error('Auth error:', authError);
      return Response.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    if (!user) {
      return Response.json({ error: 'Not authenticated. Please sign in first.' }, { status: 401 });
    }

    const body = await req.json();
    const { price, success_url, cancel_url } = body || {};
    
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return Response.json({ error: 'Payment system not configured. Please contact support.' }, { status: 500 });
    }
    
    if (!price) {
      return Response.json({ error: 'Missing price ID' }, { status: 400 });
    }

    console.log('Creating checkout session for user:', user.email, 'price:', price);

    // Get or create customer
    let profiles;
    try {
      profiles = await base44.entities.Profile.filter({ created_by: user.email });
    } catch (profileError) {
      console.error('Profile fetch error:', profileError);
      return Response.json({ error: 'Could not fetch user profile. Please complete onboarding first.' }, { status: 400 });
    }

    let customerId = profiles[0]?.stripe_customer_id;
    
    if (!customerId) {
      // Create customer via REST API
      const customerParams = new URLSearchParams();
      customerParams.append('email', user.email);
      customerParams.append('name', profiles[0]?.name || user.full_name || 'AgentVault User');
      customerParams.append('metadata[user_id]', profiles[0]?.id || user.id);
      customerParams.append('metadata[user_email]', user.email);

      try {
        const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: customerParams.toString(),
        });

        const customerData = await customerResponse.json();
        
        if (!customerResponse.ok) {
          console.error('Stripe customer creation error:', customerData);
          return Response.json({ 
            error: `Payment setup failed: ${customerData?.error?.message || 'Could not create customer'}` 
          }, { status: 400 });
        }

        customerId = customerData.id;
        console.log('Created Stripe customer:', customerId);
        
        // Save customer ID to profile
        if (profiles[0]) {
          try {
            await base44.entities.Profile.update(profiles[0].id, {
              stripe_customer_id: customerId
            });
          } catch (updateError) {
            console.error('Could not save customer ID to profile:', updateError);
            // Non-fatal, continue anyway
          }
        }
      } catch (customerError) {
        console.error('Customer creation fetch error:', customerError);
        return Response.json({ 
          error: 'Payment system connection failed. Please try again.' 
        }, { status: 500 });
      }
    } else {
      console.log('Using existing Stripe customer:', customerId);
    }

    // Determine tier from price ID (supports both LIVE and TEST prices)
    let tier = 'starter';
    
    // LIVE price IDs
    if (price === 'price_1SP8AB1Nw95Lp8qMSu9CdqJk') tier = 'pro';
    if (price === 'price_1SP8B01Nw95Lp8qMsNzWobkZ') tier = 'enterprise';
    if (price === 'price_1SP89V1Nw95Lp8qMNv6ZlA6q') tier = 'starter';
    
    // Legacy/Fallback IDs
    if (price === 'price_1SOpHB0nQRABXxQy0EOkgWYP') tier = 'pro';
    if (price === 'price_1SOpGm0nQRABXxQy3uESqqPJ') tier = 'enterprise';
    if (price === 'price_1SOpHa0nQRABXxQyK1W6nUoq') tier = 'starter';

    console.log('Detected tier:', tier, 'for price:', price);

    // Create checkout session via REST API
    const sessionParams = new URLSearchParams();
    sessionParams.append('mode', 'subscription');
    sessionParams.append('customer', customerId);
    const baseUrl = String(Deno.env.get('PUBLIC_APP_URL') || 'https://agent-vault-da3d088b.base44.app').replace(/\/+$/, '');
    sessionParams.append('success_url', success_url || `${baseUrl}/BillingSuccess?session_id={CHECKOUT_SESSION_ID}`);
    sessionParams.append('cancel_url', cancel_url || `${baseUrl}/pricing`);
    sessionParams.append('line_items[0][price]', price);
    sessionParams.append('line_items[0][quantity]', '1');
    sessionParams.append('metadata[user_id]', profiles[0]?.id || user.id);
    sessionParams.append('metadata[user_email]', user.email);
    sessionParams.append('metadata[price_id]', price);
    sessionParams.append('metadata[tier]', tier);

    try {
      const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: sessionParams.toString(),
      });

      const sessionData = await sessionResponse.json();
      
      if (!sessionResponse.ok) {
        console.error('Stripe session creation error:', sessionData);
        const errorMsg = sessionData?.error?.message || 'Could not create checkout session';
        return Response.json({ 
          error: `Checkout failed: ${errorMsg}` 
        }, { status: 400 });
      }
      
      if (!sessionData.id || !/^cs_(live|test)_/.test(sessionData.id)) {
        console.error('Invalid session ID returned:', sessionData);
        return Response.json({ 
          error: 'Payment system returned invalid session. Please try again or contact support.' 
        }, { status: 500 });
      }

      console.log('✅ Checkout session created successfully:', sessionData.id);
      return Response.json({ id: sessionData.id });

    } catch (sessionError) {
      console.error('Session creation fetch error:', sessionError);
      return Response.json({ 
        error: 'Could not connect to payment system. Please check your internet connection and try again.' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Unexpected checkout error:', error);
    return Response.json({ 
      error: `Checkout error: ${error.message || 'Unknown error occurred'}` 
    }, { status: 500 });
  }
});