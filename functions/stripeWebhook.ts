import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// STRIPE WEBHOOK HANDLER
// Handles subscription lifecycle events AND milestone payments

Deno.serve(async (req) => {
  console.log('=== Stripe Webhook Received ===');
  
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('❌ Missing Stripe credentials');
    return new Response('Configuration error', { status: 500 });
  }
  
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  
  // Get raw body for signature verification
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('❌ No Stripe signature');
    return new Response('No signature', { status: 400 });
  }
  
  let event;
  
  try {
    // Verify webhook signature
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
    console.log('✅ Webhook verified:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
  
  // Initialize Base44 SDK with service role (admin access)
  const base44 = createClientFromRequest(req);
  
  // Map Stripe price IDs to internal plan slugs
  const PRICE_TO_PLAN = {
    [Deno.env.get('STRIPE_PRICE_STARTER')]: 'starter',
    [Deno.env.get('STRIPE_PRICE_PRO')]: 'pro',
    [Deno.env.get('STRIPE_PRICE_ENTERPRISE')]: 'enterprise',
  };
  
  // Handle different event types
  try {
    switch (event.type) {
      // ========================================
      // MILESTONE PAYMENT EVENTS
      // ========================================
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log('💳 PaymentIntent succeeded:', paymentIntent.id);
        
        // Check if this is a milestone payment
        const milestoneId = paymentIntent.metadata?.milestone_id;
        
        if (milestoneId) {
          console.log('🎯 Milestone payment detected:', milestoneId);
          
          try {
            // Fetch milestone
            const milestones = await base44.asServiceRole.entities.PaymentMilestone.filter({ 
              id: milestoneId 
            });
            
            if (milestones.length === 0) {
              console.error('❌ Milestone not found:', milestoneId);
              break;
            }
            
            const milestone = milestones[0];
            console.log('📋 Milestone:', {
              id: milestone.id,
              label: milestone.label,
              status: milestone.status
            });
            
            // Only update if still pending
            if (milestone.status === 'pending') {
              await base44.asServiceRole.entities.PaymentMilestone.update(milestone.id, {
                status: 'paid',
                paid_at: new Date().toISOString(),
                stripe_payment_intent_id: paymentIntent.id
              });
              
              console.log('✅ Milestone marked as PAID:', milestone.label);
              
              // Optionally create audit log
              try {
                await base44.asServiceRole.entities.AuditLog.create({
                  actor_id: milestone.payer_profile_id || 'system',
                  actor_name: 'Stripe Payment',
                  entity_type: 'PaymentMilestone',
                  entity_id: milestone.id,
                  action: 'milestone_paid',
                  details: `Milestone "${milestone.label}" paid via Stripe. Amount: $${(paymentIntent.amount / 100).toFixed(2)}`,
                  timestamp: new Date().toISOString()
                });
              } catch (auditError) {
                console.error('⚠️ Could not create audit log:', auditError);
                // Non-fatal
              }
            } else {
              console.log('ℹ️ Milestone already marked as:', milestone.status);
            }
          } catch (milestoneError) {
            console.error('❌ Error processing milestone payment:', milestoneError);
            // Continue to return success to Stripe
          }
        } else {
          console.log('ℹ️ Non-milestone payment (maybe subscription-related)');
        }
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('❌ PaymentIntent failed:', paymentIntent.id);
        
        const milestoneId = paymentIntent.metadata?.milestone_id;
        
        if (milestoneId) {
          console.log('💔 Milestone payment failed:', milestoneId);
          
          // Optionally create audit log for failure
          try {
            await base44.asServiceRole.entities.AuditLog.create({
              actor_id: 'system',
              actor_name: 'Stripe Payment',
              entity_type: 'PaymentMilestone',
              entity_id: milestoneId,
              action: 'milestone_payment_failed',
              details: `Payment attempt failed. Error: ${paymentIntent.last_payment_error?.message || 'Unknown'}`,
              timestamp: new Date().toISOString()
            });
          } catch (auditError) {
            console.error('⚠️ Could not create audit log:', auditError);
          }
        }
        break;
      }
      
      // ========================================
      // IDENTITY EVENTS (Stripe Identity)
      // ========================================
      case 'identity.verification_session.verified': {
        const vs = event.data.object;
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
        const session = await stripe.identity.verificationSessions.retrieve(vs.id, { expand: ['last_verification_report'] });
        const userId = session.metadata?.userId || session.client_reference_id;

        // Find identity record
        const identities = userId
          ? await base44.asServiceRole.entities.UserIdentity.filter({ user_id: userId })
          : await base44.asServiceRole.entities.UserIdentity.filter({ verificationSessionId: session.id });
        const identity = identities?.[0];

        // Fetch profile for name comparison
        let profile = null;
        if (userId) {
          const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: userId });
          profile = profiles?.[0] || null;
        }

        // Extract verified name from report
        let vf = null, vl = null;
        const report = session.last_verification_report;
        if (report?.document) {
          vf = report.document?.first_name || null;
          vl = report.document?.last_name || null;
        }

        // Normalize compare with profile.full_name
        const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
        const profileName = norm(profile?.full_name || '');
        const verifiedName = norm([vf, vl].filter(Boolean).join(' '));
        const nameMatchStatus = verifiedName && profileName && verifiedName === profileName ? 'MATCH' : 'MISMATCH';

        if (identity) {
          await base44.asServiceRole.entities.UserIdentity.update(identity.id, {
            verificationStatus: 'VERIFIED',
            verifiedAt: new Date().toISOString(),
            verifiedFirstName: vf,
            verifiedLastName: vl,
            nameMatchStatus,
            lastError: null
          });
        }
        break;
      }

      case 'identity.verification_session.processing': {
        const vs = event.data.object;
        const identities = await base44.asServiceRole.entities.UserIdentity.filter({ verificationSessionId: vs.id });
        if (identities?.length) {
          await base44.asServiceRole.entities.UserIdentity.update(identities[0].id, { verificationStatus: 'PROCESSING' });
        }
        break;
      }

      case 'identity.verification_session.requires_input': {
        const vs = event.data.object;
        const identities = await base44.asServiceRole.entities.UserIdentity.filter({ verificationSessionId: vs.id });
        if (identities?.length) {
          await base44.asServiceRole.entities.UserIdentity.update(identities[0].id, { verificationStatus: 'REQUIRES_INPUT', lastError: vs.last_error?.reason || null });
        }
        break;
      }

      case 'identity.verification_session.canceled': {
        const vs = event.data.object;
        const identities = await base44.asServiceRole.entities.UserIdentity.filter({ verificationSessionId: vs.id });
        if (identities?.length) {
          await base44.asServiceRole.entities.UserIdentity.update(identities[0].id, { verificationStatus: 'CANCELED' });
        }
        break;
      }

      // ========================================
      // SUBSCRIPTION EVENTS (EXISTING)
      // ========================================
      
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('💰 Checkout completed:', session.id);
        
        // Only handle subscription checkouts
        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription;
          const customerId = session.customer;
          
          console.log('🔍 Fetching subscription:', subscriptionId);
          
          // Get full subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          console.log('📋 Subscription details:', {
            id: subscription.id,
            status: subscription.status,
            customer: subscription.customer,
            items: subscription.items.data.length
          });
          
          // Extract price ID from first line item
          const priceId = subscription.items.data[0]?.price?.id;
          const plan = PRICE_TO_PLAN[priceId] || 'unknown';
          
          console.log('💳 Plan mapping:', { priceId, plan });
          
          // Find user by Stripe customer ID
          const profiles = await base44.asServiceRole.entities.Profile.filter({
            stripe_customer_id: customerId
          });
          
          if (profiles.length === 0) {
            console.error('❌ No profile found for customer:', customerId);
            return new Response('Profile not found', { status: 404 });
          }
          
          const profile = profiles[0];
          console.log('👤 Found profile:', profile.email);
          
          // Update profile with subscription info
          await base44.asServiceRole.entities.Profile.update(profile.id, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            subscription_tier: plan,
            subscription_status: subscription.status,
            subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
          
          console.log('✅ Profile updated with subscription:', {
            tier: plan,
            status: subscription.status
          });
        }
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('🔄 Subscription updated:', subscription.id, subscription.status);
        
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId] || 'unknown';
        const customerId = subscription.customer;
        
        // Find user by Stripe customer ID
        const profiles = await base44.asServiceRole.entities.Profile.filter({
          stripe_customer_id: customerId
        });
        
        if (profiles.length === 0) {
          console.warn('⚠️ No profile found for customer:', customerId);
          return new Response('Profile not found', { status: 404 });
        }
        
        const profile = profiles[0];
        
        // Update subscription info
        await base44.asServiceRole.entities.Profile.update(profile.id, {
          stripe_subscription_id: subscription.id,
          subscription_tier: plan,
          subscription_status: subscription.status,
          subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        });
        
        console.log('✅ Profile subscription updated:', {
          email: profile.email,
          tier: plan,
          status: subscription.status
        });
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('❌ Subscription canceled:', subscription.id);
        
        const customerId = subscription.customer;
        
        // Find user by Stripe customer ID
        const profiles = await base44.asServiceRole.entities.Profile.filter({
          stripe_customer_id: customerId
        });
        
        if (profiles.length === 0) {
          console.warn('⚠️ No profile found for customer:', customerId);
          return new Response('Profile not found', { status: 404 });
        }
        
        const profile = profiles[0];
        
        // Mark subscription as canceled
        await base44.asServiceRole.entities.Profile.update(profile.id, {
          subscription_tier: 'none',
          subscription_status: 'canceled',
          stripe_subscription_id: null
        });
        
        console.log('✅ Profile subscription canceled:', profile.email);
        break;
      }
      
      default:
        console.log('ℹ️ Unhandled event type:', event.type);
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});