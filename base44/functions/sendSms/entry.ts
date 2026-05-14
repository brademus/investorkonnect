import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Sends an SMS via Sinch.
 * Payload: { to: string (E.164 phone number), message: string }
 * Can be called directly or from other backend functions.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth guard — allow either an authenticated user OR an internal service-role
    // invocation (used by notify* functions). When called via
    // `base44.asServiceRole.functions.invoke('sendSms', ...)` there is no user,
    // which is expected and must be allowed; otherwise SMS notifications never fire.
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }

    const { to, message, internal_token } = await req.json();

    // If there's no user, require the internal token to prevent abuse via direct
    // unauthenticated HTTP calls. Used by notify* backend functions.
    if (!user) {
      if (internal_token !== 'ik-internal-sms-v1') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!to || !message) {
      return Response.json({ error: 'to and message required' }, { status: 400 });
    }

    const servicePlanId = Deno.env.get('SINCH_SERVICE_PLAN_ID');
    const apiToken = Deno.env.get('SINCH_API_TOKEN');
    const fromNumber = Deno.env.get('SINCH_FROM_NUMBER');

    if (!servicePlanId || !apiToken || !fromNumber) {
      console.error('[sendSms] Sinch credentials not configured');
      return Response.json({ error: 'Sinch not configured' }, { status: 500 });
    }

    // Clean phone number — ensure E.164 format
    let cleanTo = to.replace(/[^+\d]/g, '');
    if (!cleanTo.startsWith('+')) {
      cleanTo = '+1' + cleanTo; // default US
    }

    const url = `https://us.sms.api.sinch.com/xms/v1/${servicePlanId}/batches`;

    console.log('[sendSms] Sending to', cleanTo, 'via Sinch plan:', servicePlanId.substring(0, 8) + '...');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromNumber,
        to: [cleanTo],
        body: message.substring(0, 1600),
      }),
    });

    const responseText = await res.text();
    console.log('[sendSms] Sinch response status:', res.status, 'body:', responseText);

    let result;
    try { result = JSON.parse(responseText); } catch (_) { result = { raw: responseText }; }

    if (!res.ok) {
      console.error('[sendSms] Sinch error:', JSON.stringify(result));
      return Response.json({ error: result.text || result.raw || 'Sinch error', ok: false, details: result }, { status: res.status || 400 });
    }

    console.log('[sendSms] Sent SMS to', cleanTo, 'batch_id:', result.id);
    return Response.json({ ok: true, batch_id: result.id });
  } catch (error) {
    console.error('[sendSms] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});