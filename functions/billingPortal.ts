/**
 * Billing Portal Function
 * 
 * Creates a Stripe Customer Portal session for subscription management
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-06-20',
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[billingPortal] User:', user.email);
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;
    
    if (!customerId) {
      console.log('[billingPortal] Creating Stripe customer...');
      
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile.full_name || user.full_name,
        metadata: {
          user_id: user.id,
          profile_id: profile.id,
        },
      });
      
      customerId = customer.id;
      
      // Save customer ID to profile
      await base44.entities.Profile.update(profile.id, {
        stripe_customer_id: customerId,
      });
      
      console.log('[billingPortal] Created customer:', customerId);
    }
    
    // Determine return URL based on role
    const appUrl = Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';
    const userRole = profile.user_role || profile.role;
    let returnPath = '/Dashboard';
    
    if (userRole === 'agent') {
      returnPath = '/DashboardAgent';
    } else if (userRole === 'investor') {
      returnPath = '/DashboardInvestor';
    }
    
    const returnUrl = `${appUrl}${returnPath}`;
    
    console.log('[billingPortal] Return URL:', returnUrl);
    
    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    console.log('[billingPortal] Session created:', session.id);
    
    return Response.json({
      ok: true,
      url: session.url,
    });
    
  } catch (error) {
    console.error('[billingPortal] Error:', error);
    return Response.json({
      ok: false,
      error: error.message || 'Failed to create billing portal session',
    }, { status: 500 });
  }
});