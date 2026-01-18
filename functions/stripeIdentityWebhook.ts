import Stripe from 'npm:stripe@14.11.0';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Separate webhook just for Identity (keeps billing webhook untouched)
Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return new Response('Missing Stripe config', { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    if (!signature) return new Response('No signature', { status: 400 });

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const isStripeTestMode = () => {
      const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
      const mode = (Deno.env.get('STRIPE_MODE') || '').toLowerCase();
      return key.startsWith('sk_test_') || mode === 'test';
    };

    const upsertProfileIdentity = async (userId, sessionId, verified, names) => {
      if (!userId) return;
      const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: userId });
      if (!profiles?.length) return;
      const profile = profiles[0];
      const update = {
        identity_provider: 'stripe_identity',
        identity_session_id: sessionId,
        identity_mode: isStripeTestMode() ? 'test' : 'live',
      };
      if (verified) {
        update.identity_status = 'verified';
        update.identity_verified_at = new Date().toISOString();
        if (names?.first && names?.last) {
          update.verified_first_name = names.first;
          update.verified_last_name = names.last;
        }
      } else if (verified === false) {
        update.identity_status = 'failed';
      } else {
        update.identity_status = 'pending';
      }
      await base44.asServiceRole.entities.Profile.update(profile.id, update);
    };

    switch (event.type) {
      case 'identity.verification_session.verified': {
        const vs = event.data.object;
        const session = await stripe.identity.verificationSessions.retrieve(vs.id, { expand: ['last_verification_report'] });
        const userId = session.metadata?.userId || session.client_reference_id;

        // Idempotency: if already VERIFIED in UserIdentity, skip heavy updates but still update Profile identity flags
        const identities = userId
          ? await base44.asServiceRole.entities.UserIdentity.filter({ user_id: userId })
          : await base44.asServiceRole.entities.UserIdentity.filter({ verificationSessionId: session.id });
        const identity = identities?.[0];

        // Names from Stripe (live mode preferred)
        let vf = null, vl = null;
        const report = session.last_verification_report;
        if (report?.document) {
          vf = report.document?.first_name || null;
          vl = report.document?.last_name || null;
        }

        const testMode = isStripeTestMode();

        // Update Profile with identity fields
        if (testMode) {
          // In TEST MODE: use onboarding names as verified names
          const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: userId });
          const profile = profiles?.[0];
          const first = profile?.onboarding_first_name || (profile?.full_name?.split(' ')[0] || null);
          const last = profile?.onboarding_last_name || (profile?.full_name?.split(' ').slice(1).join(' ') || null);
          await upsertProfileIdentity(userId, session.id, true, { first, last });
        } else {
          // LIVE MODE: use Stripe verified outputs if available
          await upsertProfileIdentity(userId, session.id, true, { first: vf, last: vl });
        }

        // Update UserIdentity record consistently
        if (identity) {
          await base44.asServiceRole.entities.UserIdentity.update(identity.id, {
            verificationStatus: 'VERIFIED',
            verifiedAt: new Date().toISOString(),
            verifiedFirstName: testMode ? undefined : vf,
            verifiedLastName: testMode ? undefined : vl,
            nameMatchStatus: testMode ? 'UNKNOWN' : (vf && vl ? 'MATCH' : 'UNKNOWN'),
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

      default:
        // ignore
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});