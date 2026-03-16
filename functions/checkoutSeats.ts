import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Adds N team seats directly to the owner's existing Stripe subscription.
 * Body: { count: number }
 * Minimizes sequential Base44 calls to avoid 429 rate limits.
 */
Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured' }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'Team seat price not configured.' }, { status: 500 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const count = parseInt(body.count) || 0;
    if (count < 1 || count > 10) return Response.json({ ok: false, message: 'Select between 1 and 10 seats' }, { status: 400 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) return Response.json({ ok: false, message: 'Profile not found' }, { status: 404 });
    const ownerProfile = profiles[0];

    if (!ownerProfile.stripe_subscription_id) {
      return Response.json({ ok: false, message: 'You need an active subscription before adding team seats.' }, { status: 400 });
    }

    // Verify subscription is active
    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${ownerProfile.stripe_subscription_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const subscription = await subResp.json();

    if (!subscription?.id || subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return Response.json({ ok: false, message: 'Your subscription is not active.' }, { status: 400 });
    }

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const createSeatWithRetry = async (data, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await base44.asServiceRole.entities.TeamSeat.create(data);
        } catch (err) {
          if (attempt < retries && (err?.status === 429 || err?.message?.includes('429'))) {
            await delay(500 * (attempt + 1));
            continue;
          }
          throw err;
        }
      }
    };

    const updateSeatWithRetry = async (id, data, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await base44.asServiceRole.entities.TeamSeat.update(id, data);
        } catch (err) {
          if (attempt < retries && (err?.status === 429 || err?.message?.includes('429'))) {
            await delay(500 * (attempt + 1));
            continue;
          }
          throw err;
        }
      }
    };

    // Step 1: Create seat records with spacing
    const seatIds = [];
    for (let i = 0; i < count; i++) {
      if (i > 0) await delay(200);
      try {
        const seat = await createSeatWithRetry({
          owner_profile_id: ownerProfile.id,
          owner_email: user.email.toLowerCase(),
          member_email: '',
          team_role: 'member',
          status: 'open',
          invited_at: new Date().toISOString(),
        });
        seatIds.push(seat.id);
      } catch (err) {
        console.error(`Failed to create seat ${i + 1}:`, err?.message);
      }
    }

    if (seatIds.length === 0) {
      return Response.json({ ok: false, message: 'Failed to create seats. Please try again.' }, { status: 500 });
    }

    // Step 2: Single Stripe API call to add/increment seats
    let stripeItemId = null;
    const existingSeatItem = (subscription.items?.data || []).find(item => item.price?.id === SEAT_PRICE);

    try {
      if (existingSeatItem) {
        const newQty = existingSeatItem.quantity + seatIds.length;
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
        if (!resp.ok) throw new Error(data?.error?.message || 'Stripe error');
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
            'quantity': String(seatIds.length),
            'proration_behavior': 'create_prorations',
          }).toString(),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error?.message || 'Stripe error');
        stripeItemId = data.id;
        console.log(`New seat item created: ${data.id}, qty: ${seatIds.length}`);
      }
    } catch (stripeErr) {
      console.error('Stripe error:', stripeErr?.message);
      return Response.json({ ok: false, message: `Billing failed: ${stripeErr?.message}` }, { status: 500 });
    }

    // Step 3: Update seats with Stripe item ID (with spacing)
    if (stripeItemId) {
      for (let i = 0; i < seatIds.length; i++) {
        if (i > 0) await delay(200);
        try {
          await updateSeatWithRetry(seatIds[i], { stripe_subscription_item_id: stripeItemId });
        } catch (err) {
          console.error(`Failed to update seat ${seatIds[i]} with stripe item:`, err?.message);
        }
      }
    }

    console.log(`${seatIds.length} seats purchased successfully`);

    return Response.json({
      ok: true,
      seats_purchased: seatIds.length,
      seat_ids: seatIds,
    });

  } catch (error) {
    console.error('Checkout seats error:', error);
    return Response.json({ ok: false, message: error?.message || 'Server error' }, { status: 500 });
  }
});