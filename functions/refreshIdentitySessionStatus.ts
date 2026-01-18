import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.11.0';

function mapStripeStatus(s) {
  switch (s) {
    case 'requires_input': return 'REQUIRES_INPUT';
    case 'processing': return 'PROCESSING';
    case 'verified': return 'VERIFIED';
    case 'canceled': return 'CANCELED';
    default: return 'FAILED';
  }
}

Deno.serve(async (req) => {
  try {
    const isStripeTestMode = () => {
      const key = Deno.env.get('STRIPE_SECRET_KEY') || '';
      const mode = (Deno.env.get('STRIPE_MODE') || '').toLowerCase();
      return key.startsWith('sk_test_') || mode === 'test';
    };
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const recs = await base44.entities.UserIdentity.filter({ user_id: user.id });
    const identity = recs?.[0];
    if (!identity?.verificationSessionId) return Response.json({ error: 'No verification session' }, { status: 400 });

    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (!STRIPE_SECRET_KEY) return Response.json({ error: 'Missing Stripe secret key' }, { status: 500 });
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.identity.verificationSessions.retrieve(identity.verificationSessionId, { expand: ['last_verification_report'] });
    const status = mapStripeStatus(session.status);

    const update = {
      verificationStatus: status,
      lastError: session.last_error?.reason || null
    };

    if (status === 'VERIFIED') {
      const testMode = isStripeTestMode();
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const profile = profiles?.[0] || null;

      if (testMode) {
        // Use onboarding names as verified and mark MATCH in test mode
        const first = profile?.onboarding_first_name || (profile?.full_name?.split(' ')[0] || null);
        const last = profile?.onboarding_last_name || (profile?.full_name?.split(1).length ? profile?.full_name?.split(' ').slice(1).join(' ') : null);
        update.verifiedFirstName = first;
        update.verifiedLastName = last;
        update.verifiedAt = new Date().toISOString();
        update.nameMatchStatus = 'MATCH';
        // mirror into Profile so UI uses verified_* and identity_status
        await base44.entities.Profile.update(profile.id, {
          verified_first_name: first,
          verified_last_name: last,
          identity_status: 'verified',
          identity_provider: 'stripe_identity',
          identity_session_id: identity.verificationSessionId,
          identity_verified_at: new Date().toISOString(),
          identity_mode: 'test'
        });
      } else {
        // Live: use Stripe outputs when present
        const vf = session.last_verification_report?.document?.first_name || null;
        const vl = session.last_verification_report?.document?.last_name || null;
        update.verifiedFirstName = vf;
        update.verifiedLastName = vl;
        update.verifiedAt = new Date().toISOString();
        const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
        const profileName = norm(profile?.full_name || '');
        const verifiedName = norm([vf, vl].filter(Boolean).join(' '));
        update.nameMatchStatus = vf && vl && profileName ? (verifiedName === profileName ? 'MATCH' : 'MISMATCH') : 'UNKNOWN';
        await base44.entities.Profile.update(profile.id, {
          verified_first_name: vf || profile?.verified_first_name || null,
          verified_last_name: vl || profile?.verified_last_name || null,
          identity_status: 'verified',
          identity_provider: 'stripe_identity',
          identity_session_id: identity.verificationSessionId,
          identity_verified_at: new Date().toISOString(),
          identity_mode: 'live'
        });
      }
    }

    await base44.entities.UserIdentity.update(identity.id, update);

    return Response.json({ verificationStatus: status });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});