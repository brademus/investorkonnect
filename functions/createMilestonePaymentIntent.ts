import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * CREATE MILESTONE PAYMENT INTENT
 * 
 * Creates a Stripe PaymentIntent for a specific milestone payment.
 * Reuses the same Stripe setup as subscriptions.
 * 
 * Request body:
 * - milestoneId: ID of the PaymentMilestone to pay
 * 
 * Returns:
 * - { ok: true, clientSecret: "pi_xxx_secret_yyy" }
 */
Deno.serve(async (req) => {
  console.log('=== Create Milestone Payment Intent ===');
  
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }
  
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  
  if (!STRIPE_SECRET_KEY) {
    console.error('❌ Missing Stripe secret key');
    return Response.json({ 
      ok: false, 
      error: 'Payment system not configured' 
    }, { status: 500 });
  }
  
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const base44 = createClientFromRequest(req);
  
  // Authenticate user
  let user;
  try {
    user = await base44.auth.me();
  } catch (authError) {
    console.error('❌ Auth error:', authError);
    return Response.json({ 
      ok: false, 
      error: 'Authentication required' 
    }, { status: 401 });
  }
  
  if (!user) {
    return Response.json({ 
      ok: false, 
      error: 'Not authenticated' 
    }, { status: 401 });
  }
  
  console.log('👤 User:', user.email);
  
  // Get user profile
  let profiles;
  try {
    profiles = await base44.entities.Profile.filter({ user_id: user.id });
  } catch (profileError) {
    console.error('❌ Profile fetch error:', profileError);
    return Response.json({ 
      ok: false, 
      error: 'Could not fetch user profile' 
    }, { status: 400 });
  }
  
  if (!profiles || profiles.length === 0) {
    return Response.json({ 
      ok: false, 
      error: 'User profile not found' 
    }, { status: 404 });
  }
  
  const profile = profiles[0];
  console.log('👤 Profile:', profile.id);
  
  // Parse request
  let body;
  try {
    body = await req.json();
  } catch (parseError) {
    return Response.json({ 
      ok: false, 
      error: 'Invalid request body' 
    }, { status: 400 });
  }
  
  const { milestoneId } = body;
  
  if (!milestoneId) {
    return Response.json({ 
      ok: false, 
      error: 'Missing milestoneId' 
    }, { status: 400 });
  }
  
  console.log('💳 Creating payment for milestone:', milestoneId);
  
  // Fetch milestone
  let milestone;
  try {
    const milestones = await base44.entities.PaymentMilestone.filter({ id: milestoneId });
    milestone = milestones[0];
  } catch (fetchError) {
    console.error('❌ Milestone fetch error:', fetchError);
    return Response.json({ 
      ok: false, 
      error: 'Could not fetch milestone' 
    }, { status: 500 });
  }
  
  if (!milestone) {
    return Response.json({ 
      ok: false, 
      error: 'Milestone not found' 
    }, { status: 404 });
  }
  
  console.log('📋 Milestone:', {
    id: milestone.id,
    label: milestone.label,
    amount: milestone.amount_cents,
    status: milestone.status
  });
  
  // Validate milestone is payable
  if (milestone.status !== 'pending') {
    return Response.json({ 
      ok: false, 
      error: 'Milestone is not pending' 
    }, { status: 400 });
  }
  
  // Verify user is the payer
  if (milestone.payer_profile_id !== profile.id) {
    console.error('❌ User is not the payer:', {
      user: profile.id,
      payer: milestone.payer_profile_id
    });
    return Response.json({ 
      ok: false, 
      error: 'You are not authorized to pay this milestone' 
    }, { status: 403 });
  }
  
  // Get schedule for currency
  let schedule;
  try {
    const schedules = await base44.entities.PaymentSchedule.filter({ 
      id: milestone.schedule_id 
    });
    schedule = schedules[0];
  } catch (scheduleError) {
    console.error('⚠️ Could not fetch schedule:', scheduleError);
    // Continue with default currency
  }
  
  const currency = schedule?.currency?.toLowerCase() || 'usd';
  const amountCents = milestone.amount_cents || 0;
  
  if (amountCents <= 0) {
    return Response.json({ 
      ok: false, 
      error: 'Invalid milestone amount' 
    }, { status: 400 });
  }
  
  console.log('💰 Amount:', amountCents, currency);
  
  // Get or create Stripe customer
  let customerId = profile.stripe_customer_id;
  
  if (!customerId) {
    console.log('🆕 Creating Stripe customer...');
    
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile.full_name || user.full_name || 'AgentVault User',
        metadata: {
          user_id: user.id,
          profile_id: profile.id,
          user_email: user.email
        }
      });
      
      customerId = customer.id;
      console.log('✅ Created customer:', customerId);
      
      // Save customer ID to profile
      try {
        await base44.entities.Profile.update(profile.id, {
          stripe_customer_id: customerId
        });
      } catch (updateError) {
        console.error('⚠️ Could not save customer ID:', updateError);
        // Non-fatal, continue
      }
    } catch (customerError) {
      console.error('❌ Customer creation error:', customerError);
      return Response.json({ 
        ok: false, 
        error: 'Could not create payment customer' 
      }, { status: 500 });
    }
  } else {
    console.log('✅ Using existing customer:', customerId);
  }
  
  // Create PaymentIntent
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      customer: customerId,
      automatic_payment_methods: { 
        enabled: true 
      },
      metadata: {
        milestone_id: milestone.id,
        deal_id: milestone.deal_id || '',
        schedule_id: milestone.schedule_id || '',
        payer_profile_id: milestone.payer_profile_id || '',
        payee_profile_id: milestone.payee_profile_id || '',
        label: milestone.label || 'Milestone Payment'
      },
      description: `${milestone.label || 'Milestone Payment'} - Deal Payment`
    });
    
    console.log('✅ PaymentIntent created:', paymentIntent.id);
    console.log('🔑 Client secret:', paymentIntent.client_secret?.slice(0, 20) + '...');
    
    return Response.json({ 
      ok: true, 
      clientSecret: paymentIntent.client_secret,
      amount: amountCents,
      currency
    });
    
  } catch (paymentError) {
    console.error('❌ PaymentIntent creation error:', paymentError);
    return Response.json({ 
      ok: false, 
      error: `Payment initialization failed: ${paymentError.message || 'Unknown error'}` 
    }, { status: 500 });
  }
});