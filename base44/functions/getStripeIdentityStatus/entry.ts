import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.25.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session_id } = await req.json().catch(() => ({ }));
    if (!session_id) {
      return Response.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      return Response.json({ error: 'Stripe secret not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    const session = await stripe.identity.verificationSessions.retrieve(session_id);
    const status = session.status; // 'requires_input' | 'processing' | 'verified' | 'canceled'

    // Try to fetch profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = Array.isArray(profiles) ? profiles[0] : profiles?.data?.[0];

    if (profile?.id) {
      if (status === 'verified') {
        const firstName = (session?.verified_outputs?.first_name || '').trim().toLowerCase();
        const lastName = (session?.verified_outputs?.last_name || '').trim().toLowerCase();

        // Name matching — compare against what user entered in onboarding
        const profileFirstName = (profile.onboarding_first_name || '').trim().toLowerCase();
        const profileLastName = (profile.onboarding_last_name || '').trim().toLowerCase();

        // Only check if Stripe returned a name AND the profile has a name
        const stripeReturnedName = firstName || lastName;
        const profileHasName = profileFirstName || profileLastName;

        let nameMismatch = false;
        if (stripeReturnedName && profileHasName) {
          const firstMatch = !firstName || !profileFirstName || firstName === profileFirstName;
          const lastMatch = !lastName || !profileLastName || lastName === profileLastName;
          nameMismatch = !firstMatch || !lastMatch;
        }

        if (nameMismatch) {
          console.warn(`[getStripeIdentityStatus] Name mismatch: Stripe="${firstName} ${lastName}" Profile="${profileFirstName} ${profileLastName}"`);
          await base44.entities.Profile.update(profile.id, {
            identity_status: 'failed',
            kyc_status: 'failed',
            identity_verified_at: null,
            verified_first_name: session?.verified_outputs?.first_name || undefined,
            verified_last_name: session?.verified_outputs?.last_name || undefined,
          });
          return Response.json({
            status: 'name_mismatch',
            session_id,
            verified_outputs: session?.verified_outputs || null,
            last_error: { message: 'The name on your ID does not match the name you entered. Please update your details and try again.' },
          });
        }

        // Name matches (or no name to compare) — full approval
        await base44.entities.Profile.update(profile.id, {
          identity_status: 'verified',
          identity_verified_at: new Date().toISOString(),
          kyc_status: 'approved',
          verified_first_name: session?.verified_outputs?.first_name || undefined,
          verified_last_name: session?.verified_outputs?.last_name || undefined,
          identity_mode: (Deno.env.get('STRIPE_MODE') === 'live') ? 'live' : 'test',
        });
      } else if (status === 'requires_input') {
        await base44.entities.Profile.update(profile.id, {
          identity_status: 'failed',
          kyc_status: 'failed',
          identity_verified_at: null,
        });
      } else if (status === 'processing') {
        await base44.entities.Profile.update(profile.id, {
          identity_status: 'pending',
          kyc_status: 'pending',
        });
      }
    }

    return Response.json({
      status,
      session_id,
      verified_outputs: session?.verified_outputs || null,
      last_error: session?.last_error || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});