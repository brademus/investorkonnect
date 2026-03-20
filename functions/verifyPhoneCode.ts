import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Reports/verifies a Sinch Verification SMS code.
 * Payload: { phone: string, code: string }
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { phone, code } = await req.json();
  if (!phone || !code) return Response.json({ error: 'phone and code required' }, { status: 400 });

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return Response.json({ error: 'Invalid phone number' }, { status: 400 });

  const e164 = digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+1${digits}`;
  // URL-encode the + sign for the path
  const encodedPhone = encodeURIComponent(e164);

  const appKey = Deno.env.get('Sinch_KEY_verification');
  const appSecret = Deno.env.get('Sinch_secret_verification');

  if (!appKey || !appSecret) {
    return Response.json({ error: 'Sinch Verification not configured' }, { status: 500 });
  }

  const basicAuth = btoa(`${appKey}:${appSecret}`);

  console.log('[verifyPhoneCode] Reporting code for', e164);

  const res = await fetch(`https://verification.api.sinch.com/verification/v1/verifications/number/${encodedPhone}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method: 'sms',
      sms: { code: code.trim() },
    }),
  });

  const body = await res.text();
  console.log('[verifyPhoneCode] Sinch response:', res.status, body);

  let result;
  try { result = JSON.parse(body); } catch (_) { result = { raw: body }; }

  if (!res.ok) {
    console.error('[verifyPhoneCode] Sinch error:', JSON.stringify(result));
    return Response.json({ ok: false, error: result.message || 'Verification failed' }, { status: 400 });
  }

  // Check if Sinch says it's verified
  if (result.status !== 'SUCCESSFUL') {
    return Response.json({ ok: false, error: 'Invalid code. Please try again.' }, { status: 400 });
  }

  // Mark phone as verified on profile
  const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
  const profile = profiles?.[0];
  if (profile) {
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      phone: e164,
      metadata: {
        ...(profile.metadata || {}),
        phone_verification: { phone: e164, verified: true, verified_at: new Date().toISOString() }
      }
    });
  }

  return Response.json({ ok: true, verified: true });
});