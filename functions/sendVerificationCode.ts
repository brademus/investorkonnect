import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Starts a Sinch Verification SMS flow.
 * Sinch generates and sends the OTP code automatically.
 * Payload: { phone: string (formatted like "(262) 417-0268") }
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone } = await req.json();
  if (!phone) return Response.json({ error: 'phone required' }, { status: 400 });

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return Response.json({ error: 'Invalid phone number' }, { status: 400 });

  // Build E.164 number
  const e164 = digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+1${digits}`;

  const appKey = Deno.env.get('Sinch_KEY_verification');
  const appSecret = Deno.env.get('Sinch_secret_verification');

  if (!appKey || !appSecret) {
    console.error('[sendVerificationCode] Sinch Verification credentials not configured');
    return Response.json({ error: 'Sinch Verification not configured' }, { status: 500 });
  }

  // Basic auth: base64(application_key:application_secret)
  const basicAuth = btoa(`${appKey}:${appSecret}`);

  console.log('[sendVerificationCode] Starting SMS verification for', e164);

  const res = await fetch('https://verification.api.sinch.com/verification/v1/verifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identity: { type: 'number', endpoint: e164 },
      method: 'sms',
    }),
  });

  const body = await res.text();
  console.log('[sendVerificationCode] Sinch response:', res.status, body);

  let result;
  try { result = JSON.parse(body); } catch (_) { result = { raw: body }; }

  if (!res.ok) {
    console.error('[sendVerificationCode] Sinch Verification error:', JSON.stringify(result));
    return Response.json({ error: result.message || result.raw || 'Failed to send verification SMS', details: result }, { status: res.status });
  }

  // Store the phone on the profile so verifyPhoneCode knows which number to verify
  const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
  const profile = profiles?.[0];
  if (profile) {
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      metadata: {
        ...(profile.metadata || {}),
        phone_verification: { phone: e164, started_at: new Date().toISOString() }
      }
    });
  }

  return Response.json({ ok: true, message: 'Verification code sent' });
});