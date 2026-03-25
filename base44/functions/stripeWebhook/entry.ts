import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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
    [Deno.env.get('STRIPE_PRICE_MEMBERSHIP')]: 'starter',
  };
  // Remove undefined key if env var not set
  delete PRICE_TO_PLAN[undefined];
  
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
          const subPlan = subscription.metadata?.plan;
          if (subPlan === 'seats_only') {
            // Seats-only subscription — store separately, don't overwrite membership
            console.log('📋 Seats-only subscription — not overwriting membership sub');
          } else {
            // Membership subscription (solo or team)
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

          // === TEAM SEAT ACTIVATION ===
          // If this subscription was created via team checkout, activate pending seats
          const seatIdsStr = subscription.metadata?.seat_ids || '';
          const seatEmails = subscription.metadata?.seat_emails || '';
          if (seatIdsStr) {
            const seatIds = seatIdsStr.split(',').filter(Boolean);
            const emails = seatEmails.split(',').filter(Boolean);
            console.log(`🏢 Activating ${seatIds.length} team seats from checkout...`);

            const appUrl = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');

            for (let i = 0; i < seatIds.length; i++) {
              try {
                const seatId = seatIds[i];
                const email = emails[i] || '';

                // Check if the seat has an email assigned — if yes, set to 'invited'; if no, set to 'open'
                const seatRecords = await base44.asServiceRole.entities.TeamSeat.filter({ id: seatId });
                const seatRecord = seatRecords[0];
                const newStatus = (seatRecord?.member_email && seatRecord.member_email.trim()) ? 'invited' : 'open';
                
                await base44.asServiceRole.entities.TeamSeat.update(seatId, {
                  status: newStatus,
                });

                // Invite user to the app
                try {
                  await base44.asServiceRole.users.inviteUser(email, 'user');
                } catch (_) {}

                // Send invite email
                try {
                  const inviteUrl = `${appUrl}/AcceptInvite?seatId=${seatId}`;
                  await base44.asServiceRole.integrations.Core.SendEmail({
                    to: email,
                    subject: `You've been invited to join a team on Investor Konnect`,
                    body: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #E3C567;">Team Invitation</h2>
                        <p>You've been invited to join a team on Investor Konnect.</p>
                        <p>As a team member, you'll have access to shared deal pipeline and collaboration tools.</p>
                        <div style="margin: 30px 0; text-align: center;">
                          <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:#E3C567;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">View Invitation</a>
                        </div>
                        <p style="color: #808080; font-size: 13px;">Click above to accept or decline.</p>
                      </div>
                    `
                  });
                } catch (emailErr) {
                  console.error(`Failed to send invite email to ${email}:`, emailErr?.message);
                }

                console.log(`✅ Seat ${seatId} set to ${newStatus} for ${email || '(unassigned)'}`);
              } catch (seatErr) {
                console.error(`Failed to activate seat ${seatIds[i]}:`, seatErr?.message);
              }
            }
          }
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
        let profiles = await base44.asServiceRole.entities.Profile.filter({
          stripe_customer_id: customerId
        });
        
        // Fallback: look up by stripe_subscription_id
        if (profiles.length === 0) {
          console.log('🔍 Trying fallback lookup by stripe_subscription_id:', subscription.id);
          profiles = await base44.asServiceRole.entities.Profile.filter({
            stripe_subscription_id: subscription.id
          });
        }
        
        // Fallback: look up by Stripe customer email
        if (profiles.length === 0) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (customer?.email) {
              console.log('🔍 Trying fallback lookup by email:', customer.email);
              profiles = await base44.asServiceRole.entities.Profile.filter({
                email: customer.email.toLowerCase()
              });
              // Backfill stripe_customer_id so future lookups work
              if (profiles.length > 0) {
                await base44.asServiceRole.entities.Profile.update(profiles[0].id, {
                  stripe_customer_id: customerId
                });
                console.log('✅ Backfilled stripe_customer_id on profile:', profiles[0].email);
              }
            }
          } catch (custErr) {
            console.warn('⚠️ Could not fetch Stripe customer for fallback:', custErr?.message);
          }
        }
        
        if (profiles.length === 0) {
          console.warn('⚠️ No profile found for customer:', customerId);
          // Return 200 so Stripe doesn't retry endlessly
          return new Response(JSON.stringify({ received: true, warning: 'profile_not_found' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        const profile = profiles[0];
        
        // Update subscription info
        const subUpdate = {
          stripe_subscription_id: subscription.id,
          subscription_tier: plan,
          subscription_status: subscription.status,
          stripe_customer_id: customerId,
        };
        await base44.asServiceRole.entities.Profile.update(profile.id, subUpdate);
        
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
        
        // Find user by Stripe customer ID with fallbacks
        let delProfiles = await base44.asServiceRole.entities.Profile.filter({
          stripe_customer_id: customerId
        });
        if (delProfiles.length === 0) {
          delProfiles = await base44.asServiceRole.entities.Profile.filter({
            stripe_subscription_id: subscription.id
          });
        }
        if (delProfiles.length === 0) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (customer?.email) {
              delProfiles = await base44.asServiceRole.entities.Profile.filter({
                email: customer.email.toLowerCase()
              });
            }
          } catch (_) {}
        }
        
        if (delProfiles.length === 0) {
          console.warn('⚠️ No profile found for customer:', customerId);
          return new Response(JSON.stringify({ received: true, warning: 'profile_not_found' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        
        const profile = delProfiles[0];
        
        // Mark subscription as canceled
        await base44.asServiceRole.entities.Profile.update(profile.id, {
          subscription_tier: 'none',
          subscription_status: 'canceled',
          stripe_subscription_id: null
        });
        
        console.log('✅ Profile subscription canceled:', profile.email);
        break;
      }
      
      // ========================================
      // IDENTITY VERIFICATION EVENTS
      // ========================================

      case 'identity.verification_session.verified': {
        const verificationSession = event.data.object;
        console.log('✅ Identity verification session verified:', verificationSession.id);

        const metadataProfileId = verificationSession.metadata?.profile_id;
        if (!metadataProfileId) {
          console.warn('⚠️ No profile_id in identity session metadata');
          break;
        }

        try {
          // Extract name from verified_outputs or fall back to document report
          let firstName = (verificationSession?.verified_outputs?.first_name || '').trim().toLowerCase();
          let lastName = (verificationSession?.verified_outputs?.last_name || '').trim().toLowerCase();

          // In test mode, verified_outputs may be empty — try retrieving the full report
          if (!firstName && !lastName) {
            try {
              const fullSession = await stripe.identity.verificationSessions.retrieve(verificationSession.id, {
                expand: ['last_verification_report'],
              });
              if (fullSession?.last_verification_report?.document) {
                firstName = (fullSession.last_verification_report.document.first_name || '').trim().toLowerCase();
                lastName = (fullSession.last_verification_report.document.last_name || '').trim().toLowerCase();
                console.log(`[webhook] Fell back to report document: "${firstName} ${lastName}"`);
              }
            } catch (reportErr) {
              console.warn('[webhook] Could not fetch verification report:', reportErr.message);
            }
          }

          // Fetch profile to compare names
          const profile = await base44.asServiceRole.entities.Profile.get(metadataProfileId);
          let profileFirstName = (profile?.onboarding_first_name || '').trim().toLowerCase();
          let profileLastName = (profile?.onboarding_last_name || '').trim().toLowerCase();
          if (!profileFirstName && !profileLastName && profile?.full_name) {
            const nameParts = profile.full_name.trim().toLowerCase().split(/\s+/);
            profileFirstName = nameParts[0] || '';
            profileLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          }

          // Stripe often returns "FIRST MIDDLE" in first_name — only compare the first word
          const stripeFirstOnly = firstName ? firstName.split(/\s+/)[0] : '';

          const stripeReturnedName = stripeFirstOnly || lastName;
          const profileHasName = profileFirstName || profileLastName;
          let nameMismatch = false;

          if (stripeReturnedName && profileHasName) {
            const firstMatch = !stripeFirstOnly || !profileFirstName || stripeFirstOnly === profileFirstName;
            const lastMatch = !lastName || !profileLastName || lastName === profileLastName;
            nameMismatch = !firstMatch || !lastMatch;
          }

          if (nameMismatch) {
            console.warn(`[webhook] Name mismatch: Stripe="${firstName} ${lastName}" Profile="${profileFirstName} ${profileLastName}"`);
            await base44.asServiceRole.entities.Profile.update(metadataProfileId, {
              identity_status: 'failed',
              kyc_status: 'failed',
              identity_verified_at: null,
              verified_first_name: firstName || undefined,
              verified_last_name: lastName || undefined,
            });
            console.log('❌ Profile kyc_status set to failed (name mismatch) via webhook:', metadataProfileId);
          } else {
            await base44.asServiceRole.entities.Profile.update(metadataProfileId, {
              identity_status: 'verified',
              kyc_status: 'approved',
              identity_verified_at: new Date().toISOString(),
              verified_first_name: firstName || undefined,
              verified_last_name: lastName || undefined,
              identity_mode: (Deno.env.get('STRIPE_MODE') === 'live') ? 'live' : 'test',
            });
            console.log('✅ Profile kyc_status set to approved via webhook:', metadataProfileId);
          }
        } catch (err) {
          console.error('❌ Failed to update profile on identity verified webhook:', err.message);
        }
        break;
      }

      case 'identity.verification_session.requires_input': {
        const verificationSession = event.data.object;
        console.log('❌ Identity verification session requires input:', verificationSession.id);

        const metadataProfileId = verificationSession.metadata?.profile_id;
        if (!metadataProfileId) break;

        try {
          await base44.asServiceRole.entities.Profile.update(metadataProfileId, {
            identity_status: 'failed',
            kyc_status: 'failed',
            identity_verified_at: null,
          });
          console.log('✅ Profile kyc_status set to failed via webhook:', metadataProfileId);
        } catch (err) {
          console.error('❌ Failed to update profile on identity failed webhook:', err.message);
        }
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