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

    switch (event.type) {
      case 'identity.verification_session.verified': {
        const vs = event.data.object;
        const session = await stripe.identity.verificationSessions.retrieve(vs.id, { expand: ['last_verification_report'] });
        const userId = session.metadata?.userId || session.client_reference_id;

        const identities = userId
          ? await base44.asServiceRole.entities.UserIdentity.filter({ user_id: userId })
          : await base44.asServiceRole.entities.UserIdentity.filter({ verificationSessionId: session.id });
        const identity = identities?.[0];

        let profile = null;
        if (userId) {
          const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: userId });
          profile = profiles?.[0] || null;
        }

        let vf = null, vl = null;
        const report = session.last_verification_report;
        if (report?.document) {
          vf = report.document?.first_name || null;
          vl = report.document?.last_name || null;
        }

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

      default:
        // ignore
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});