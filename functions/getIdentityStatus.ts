import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = body?.session_id;

    if (!sessionId) {
      return Response.json({ error: 'session_id required' }, { status: 400 });
    }

    // Get Stripe secret key
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    // Check Stripe verification session status directly (fast call, no DB queries)
    const session = await stripe.identity.verificationSessions.retrieve(sessionId);
    
    const status = session?.status === 'verified' ? 'verified' : 'processing';

    return Response.json({ status });
  } catch (error) {
    console.error('[getStripeIdentityStatus] Error:', error.message);
    return Response.json({ 
      status: 'error',
      error: error.message 
    }, { status: 500 });
  }
});