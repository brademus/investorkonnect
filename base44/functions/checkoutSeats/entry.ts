import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * CHECKOUT SEATS — Adds team seat billing to Stripe.
 * Body: { count, subscription_id, profile_id }
 * 
 * Exactly 1 Base44 SDK call (auth.me) to verify the user is logged in.
 * All Stripe calls are direct fetch. No entity reads or writes.
 * Seat records are created by teamManage list action on next page load.
 */
Deno.serve(async (req) => {
  const diag = { step: 'init', stripe_key_type: '', price_id: '', sub_id: '', sub_status: '', stripe_response: null };

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    diag.stripe_key_type = STRIPE_SECRET_KEY ? (STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN') : 'NOT_SET';
    diag.price_id = SEAT_PRICE || 'NOT_SET';

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured', diag }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'STRIPE_PRICE_TEAM_SEAT not set', diag }, { status: 500 });

    // 1 SDK call: verify authenticated
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized', diag }, { status: 401 });

    const body = await req.json();
    const count = parseInt(body.count) || 0;
    const subscriptionId = body.subscription_id;
    const profileId = body.profile_id;

    diag.sub_id = subscriptionId || 'NOT_SET';

    if (count < 1 || count > 10) return Response.json({ ok: false, message: 'Select between 1 and 10 seats', diag }, { status: 400 });
    if (!subscriptionId) return Response.json({ ok: false, message: 'Missing subscription ID. Do you have an active subscription?', diag }, { status: 400 });

    // Stripe call 1: fetch subscription
    diag.step = 'fetch_subscription';
    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });

    if (!subResp.ok) {
      const errText = await subResp.text();
      diag.stripe_response = { status: subResp.status, body: errText.slice(0, 500) };
      return Response.json({ ok: false, message: `Subscription not found: ${subResp.status}. Check Stripe ${diag.stripe_key_type} mode.`, diag }, { status: 400 });
    }

    const subscription = await subResp.json();
    diag.sub_status = subscription.status;

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return Response.json({ ok: false, message: `Subscription is ${subscription.status}`, diag }, { status: 400 });
    }

    // Stripe call 2: add or increment seat line item
    diag.step = 'add_seats';
    const existingSeatItem = (subscription.items?.data || []).find(item => item.price?.id === SEAT_PRICE);
    let stripeItemId = null;
    let resultQty = 0;

    if (existingSeatItem) {
      const newQty = existingSeatItem.quantity + count;
      const resp = await fetch(`https://api.stripe.com/v1/subscription_items/${existingSeatItem.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'quantity': String(newQty), 'proration_behavior': 'always_invoice' }).toString(),
      });
      const data = await resp.json();
      diag.stripe_response = { status: resp.status, ok: resp.ok, item_id: data?.id, quantity: data?.quantity, error: data?.error?.message };
      if (!resp.ok) return Response.json({ ok: false, message: `Stripe error: ${data?.error?.message || 'unknown'}`, diag }, { status: 500 });
      stripeItemId = existingSeatItem.id;
      resultQty = data.quantity;
    } else {
      const resp = await fetch('https://api.stripe.com/v1/subscription_items', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'subscription': subscription.id, 'price': SEAT_PRICE, 'quantity': String(count), 'proration_behavior': 'always_invoice' }).toString(),
      });
      const data = await resp.json();
      diag.stripe_response = { status: resp.status, ok: resp.ok, item_id: data?.id, quantity: data?.quantity, error: data?.error?.message };
      if (!resp.ok) return Response.json({ ok: false, message: `Stripe error: ${data?.error?.message || 'unknown'}`, diag }, { status: 500 });
      stripeItemId = data.id;
      resultQty = data.quantity;
    }

    diag.step = 'done';

    return Response.json({
      ok: true,
      seats_purchased: count,
      stripe_item_id: stripeItemId,
      stripe_quantity: resultQty,
      profile_id: profileId,
      diag,
    });

  } catch (error) {
    diag.step = 'fatal_error';
    return Response.json({ ok: false, message: error?.message || 'Server error', diag }, { status: 500 });
  }
});