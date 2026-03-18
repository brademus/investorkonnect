import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Sends a 6-digit verification code via SMS and stores it on the user's profile metadata.
 * Payload: { phone: string (formatted like "(262) 417-0268") }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone } = await req.json();
    if (!phone) return Response.json({ error: 'phone required' }, { status: 400 });

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return Response.json({ error: 'Invalid phone number' }, { status: 400 });

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min expiry

    // Store code on profile metadata
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const profile = profiles?.[0];
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

    await base44.asServiceRole.entities.Profile.update(profile.id, {
      metadata: {
        ...(profile.metadata || {}),
        phone_verification: {
          code,
          phone: digits,
          expires_at: expiresAt,
          attempts: 0,
        }
      }
    });

    // Send SMS via Sinch
    await base44.asServiceRole.functions.invoke('sendSms', {
      to: phone,
      message: `Your Investor Konnect verification code is: ${code}. It expires in 10 minutes.`,
    });

    console.log('[sendVerificationCode] Code sent to', digits.slice(-4));
    return Response.json({ ok: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('[sendVerificationCode] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});