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
      const vf = session.last_verification_report?.document?.first_name || null;
      const vl = session.last_verification_report?.document?.last_name || null;
      update.verifiedFirstName = vf;
      update.verifiedLastName = vl;
      update.verifiedAt = new Date().toISOString();
      // Attempt local name match when possible
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const profile = profiles?.[0] || null;
      const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
      const profileName = norm(profile?.full_name || '');
      const verifiedName = norm([vf, vl].filter(Boolean).join(' '));
      update.nameMatchStatus = verifiedName && profileName && verifiedName === profileName ? 'MATCH' : 'MISMATCH';
    }

    await base44.entities.UserIdentity.update(identity.id, update);

    return Response.json({ verificationStatus: status });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});