import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Adds team seat billing to Stripe.
 * Body: { count, subscription_id, profile_id }
 * 
 * Exactly 1 Base44 SDK call (auth.me) to verify the user is logged in.
 * All Stripe calls are direct fetch. No entity reads or writes.
 * Seat records are created by teamManage list action on next page load.
 */
Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured' }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'STRIPE_PRICE_TEAM_SEAT not set' }, { status: 500 });

    // 1 SDK call: verify authenticated
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const count = parseInt(body.count) || 0;
    const subscriptionId = body.subscription_id;
    const profileId = body.profile_id;

    if (count < 1 || count > 10) return Response.json({ ok: false, message: 'Select between 1 and 10 seats' }, { status: 400 });
    if (!subscriptionId) return Response.json({ ok: false, message: 'Missing subscription ID' }, { status: 400 });

    // Stripe call 1: fetch subscription (direct fetch — not an SDK call)
    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });

    if (!subResp.ok) {
      const errData = await subResp.json().catch(() => ({}));
      return Response.json({ ok: false, message: `Subscription not found or invalid: ${errData?.error?.message || subResp.status}` }, { status: 400 });
    }

    const subscription = await subResp.json();

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return Response.json({ ok: false, message: `Subscription is ${subscription.status}` }, { status: 400 });
    }

    // Stripe call 2: add or increment seat billing
    const existingSeatItem = (subscription.items?.data || []).find(item => item.price?.id === SEAT_PRICE);
    let stripeItemId = null;
    let resultQty = 0;

    if (existingSeatItem) {
      const newQty = existingSeatItem.quantity + count;
      const resp = await fetch(`https://api.stripe.com/v1/subscription_items/${existingSeatItem.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'quantity': String(newQty),
          'proration_behavior': 'create_prorations',
        }).toString(),
      });
      const data = await resp.json();
      if (!resp.ok) return Response.json({ ok: false, message: `Stripe error: ${data?.error?.message || 'unknown'}` }, { status: 500 });
      stripeItemId = existingSeatItem.id;
      resultQty = data.quantity;
    } else {
      const resp = await fetch('https://api.stripe.com/v1/subscription_items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'subscription': subscription.id,
          'price': SEAT_PRICE,
          'quantity': String(count),
          'proration_behavior': 'create_prorations',
        }).toString(),
      });
      const data = await resp.json();
      if (!resp.ok) return Response.json({ ok: false, message: `Stripe error: ${data?.error?.message || 'unknown'}` }, { status: 500 });
      stripeItemId = data.id;
      resultQty = data.quantity;
    }

    return Response.json({
      ok: true,
      seats_purchased: count,
      stripe_item_id: stripeItemId,
      stripe_quantity: resultQty,
      profile_id: profileId,
    });

  } catch (error) {
    return Response.json({ ok: false, message: error?.message || 'Server error' }, { status: 500 });
  }
});