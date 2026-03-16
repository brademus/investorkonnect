import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Adds team seat billing to the owner's Stripe subscription.
 * Body: { count: number }
 * 
 * This function ONLY handles Stripe billing (3 Base44 SDK calls max to avoid 429).
 * Actual TeamSeat records are created lazily by teamManage.ts on next page load.
 */
Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured' }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'Team seat price not configured.' }, { status: 500 });

    // SDK call 1: auth
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const count = parseInt(body.count) || 0;
    if (count < 1 || count > 10) return Response.json({ ok: false, message: 'Select between 1 and 10 seats' }, { status: 400 });

    // SDK call 2: get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) return Response.json({ ok: false, message: 'Profile not found' }, { status: 404 });
    const ownerProfile = profiles[0];

    if (!ownerProfile.stripe_subscription_id) {
      return Response.json({ ok: false, message: 'You need an active subscription before adding team seats.' }, { status: 400 });
    }

    // Stripe call 1: fetch subscription (direct fetch, not SDK)
    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${ownerProfile.stripe_subscription_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const subscription = await subResp.json();

    if (!subResp.ok || subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return Response.json({ ok: false, message: 'Your subscription is not active.' }, { status: 400 });
    }

    // Stripe call 2: add/increment seat billing
    const existingSeatItem = (subscription.items?.data || []).find(item => item.price?.id === SEAT_PRICE);
    let stripeItemId = null;

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
      if (!resp.ok) return Response.json({ ok: false, message: `Billing failed: ${data?.error?.message || 'unknown'}` }, { status: 500 });
      stripeItemId = existingSeatItem.id;
      console.log(`Seat quantity updated: ${existingSeatItem.quantity} -> ${newQty}`);
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
      if (!resp.ok) return Response.json({ ok: false, message: `Billing failed: ${data?.error?.message || 'unknown'}` }, { status: 500 });
      stripeItemId = data.id;
      console.log(`New seat item created: ${data.id}, qty: ${count}`);
    }

    // SDK call 3: store pending seats on profile for lazy creation
    const existingPending = ownerProfile.pending_seats_count || 0;
    await base44.asServiceRole.entities.Profile.update(ownerProfile.id, {
      pending_seats_count: existingPending + count,
      stripe_seat_item_id: stripeItemId,
    });

    console.log(`${count} seats billed. Pending seats: ${existingPending + count}. Stripe item: ${stripeItemId}`);

    return Response.json({
      ok: true,
      seats_purchased: count,
      stripe_item_id: stripeItemId,
    });

  } catch (error) {
    console.error('checkoutSeats error:', error?.message || error);
    return Response.json({ ok: false, message: error?.message || 'Server error' }, { status: 500 });
  }
});