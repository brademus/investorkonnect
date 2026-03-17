import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Verifies a 6-digit phone verification code.
 * Payload: { code: string, phone: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, phone } = await req.json();
    if (!code || !phone) return Response.json({ error: 'code and phone required' }, { status: 400 });

    const digits = phone.replace(/\D/g, '');

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    const verification = profile.metadata?.phone_verification;
    if (!verification) return Response.json({ error: 'No verification pending', verified: false }, { status: 400 });

    // Check attempts (max 5)
    if (verification.attempts >= 5) {
      return Response.json({ error: 'Too many attempts. Please request a new code.', verified: false }, { status: 429 });
    }

    // Increment attempts
    await base44.entities.Profile.update(profile.id, {
      metadata: {
        ...(profile.metadata || {}),
        phone_verification: {
          ...verification,
          attempts: (verification.attempts || 0) + 1,
        }
      }
    });

    // Check expiry
    if (new Date(verification.expires_at) < new Date()) {
      return Response.json({ error: 'Code expired. Please request a new one.', verified: false }, { status: 400 });
    }

    // Check phone matches
    if (verification.phone !== digits) {
      return Response.json({ error: 'Phone number mismatch. Please request a new code.', verified: false }, { status: 400 });
    }

    // Check code
    if (verification.code !== code.trim()) {
      return Response.json({ error: 'Incorrect code. Please try again.', verified: false }, { status: 400 });
    }

    // Success — mark phone as verified
    await base44.entities.Profile.update(profile.id, {
      metadata: {
        ...(profile.metadata || {}),
        phone_verified: true,
        phone_verified_number: digits,
        phone_verified_at: new Date().toISOString(),
        phone_verification: null, // clear pending verification
      }
    });

    console.log('[verifyPhoneCode] Phone verified for user:', user.id);
    return Response.json({ ok: true, verified: true });
  } catch (error) {
    console.error('[verifyPhoneCode] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});