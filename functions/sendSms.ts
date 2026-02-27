import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sends an SMS via Twilio.
 * Payload: { to: string (E.164 phone number), message: string }
 * Can be called directly or from other backend functions.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { to, message } = await req.json();
    if (!to || !message) {
      return Response.json({ error: 'to and message required' }, { status: 400 });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[sendSms] Twilio credentials not configured');
      return Response.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    // Clean phone number — ensure E.164 format
    let cleanTo = to.replace(/[^+\d]/g, '');
    if (!cleanTo.startsWith('+')) {
      cleanTo = '+1' + cleanTo; // default US
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: cleanTo,
      From: fromNumber,
      Body: message.substring(0, 1600) // Twilio limit
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const result = await res.json();

    if (!res.ok || result.error_code) {
      console.error('[sendSms] Twilio error:', JSON.stringify(result));
      return Response.json({ error: result.message || 'Twilio error', ok: false, details: result }, { status: res.status || 400 });
    }

    console.log('[sendSms] Sent SMS to', cleanTo, 'sid:', result.sid);
    return Response.json({ ok: true, sid: result.sid });
  } catch (error) {
    console.error('[sendSms] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});