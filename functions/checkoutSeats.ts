import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Adds team seats to the owner's existing Stripe subscription.
 * Body: { count: number }
 * 
 * Order of operations:
 * 1. Validate user + subscription
 * 2. Call Stripe FIRST to add/increment seat billing
 * 3. Only THEN create TeamSeat records in the database
 * This ensures we never create phantom seats without billing.
 */
Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    console.log('=== checkoutSeats START ===');
    console.log('STRIPE_SECRET_KEY present:', !!STRIPE_SECRET_KEY);
    console.log('STRIPE_PRICE_TEAM_SEAT:', SEAT_PRICE || 'NOT SET');

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

    console.log('Owner:', ownerProfile.email, 'Sub ID:', ownerProfile.stripe_subscription_id);

    if (!ownerProfile.stripe_subscription_id) {
      return Response.json({ ok: false, message: 'You need an active subscription before adding team seats.' }, { status: 400 });
    }

    // === STEP 1: Fetch and verify subscription from Stripe ===
    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${ownerProfile.stripe_subscription_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const subscription = await subResp.json();

    console.log('Stripe sub response status:', subResp.status);
    console.log('Stripe sub id:', subscription?.id, 'status:', subscription?.status);

    if (!subResp.ok) {
      console.error('Stripe sub fetch error:', JSON.stringify(subscription?.error || subscription));
      return Response.json({ ok: false, message: `Could not verify subscription: ${subscription?.error?.message || 'unknown error'}` }, { status: 400 });
    }

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return Response.json({ ok: false, message: 'Your subscription is not active.' }, { status: 400 });
    }

    // Check for existing seat line item
    const existingSeatItem = (subscription.items?.data || []).find(item => item.price?.id === SEAT_PRICE);
    console.log('Existing seat item:', existingSeatItem ? `id=${existingSeatItem.id}, qty=${existingSeatItem.quantity}` : 'NONE');

    // === STEP 2: Call Stripe to add/increment seat billing FIRST ===
    let stripeItemId = null;

    if (existingSeatItem) {
      const newQty = existingSeatItem.quantity + count;
      console.log(`Updating seat item ${existingSeatItem.id} quantity: ${existingSeatItem.quantity} -> ${newQty}`);

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
      console.log('Stripe update response:', resp.status, JSON.stringify(data?.id ? { id: data.id, qty: data.quantity } : data?.error));

      if (!resp.ok) {
        return Response.json({ ok: false, message: `Stripe billing failed: ${data?.error?.message || 'unknown'}` }, { status: 500 });
      }
      stripeItemId = existingSeatItem.id;
    } else {
      console.log(`Creating new seat item: price=${SEAT_PRICE}, qty=${count}, sub=${subscription.id}`);

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
      console.log('Stripe create response:', resp.status, JSON.stringify(data?.id ? { id: data.id, qty: data.quantity } : data?.error));

      if (!resp.ok) {
        return Response.json({ ok: false, message: `Stripe billing failed: ${data?.error?.message || 'unknown'}` }, { status: 500 });
      }
      stripeItemId = data.id;
    }

    console.log('Stripe billing confirmed. Item ID:', stripeItemId);

    // === STEP 3: Create TeamSeat records (billing is already secured) ===
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const seatIds = [];

    for (let i = 0; i < count; i++) {
      if (i > 0) await delay(250);
      try {
        const seat = await base44.asServiceRole.entities.TeamSeat.create({
          owner_profile_id: ownerProfile.id,
          owner_email: user.email.toLowerCase(),
          member_email: '',
          team_role: 'member',
          status: 'open',
          invited_at: new Date().toISOString(),
          stripe_subscription_item_id: stripeItemId,
        });
        seatIds.push(seat.id);
        console.log(`Seat ${i + 1}/${count} created: ${seat.id}`);
      } catch (err) {
        console.error(`Seat ${i + 1}/${count} create failed:`, err?.message);
        await delay(1000);
        try {
          const seat = await base44.asServiceRole.entities.TeamSeat.create({
            owner_profile_id: ownerProfile.id,
            owner_email: user.email.toLowerCase(),
            member_email: '',
            team_role: 'member',
            status: 'open',
            invited_at: new Date().toISOString(),
            stripe_subscription_item_id: stripeItemId,
          });
          seatIds.push(seat.id);
          console.log(`Seat ${i + 1}/${count} created on retry: ${seat.id}`);
        } catch (retryErr) {
          console.error(`Seat ${i + 1}/${count} retry also failed:`, retryErr?.message);
        }
      }
    }

    console.log(`${seatIds.length}/${count} seats created. Stripe item: ${stripeItemId}`);

    return Response.json({
      ok: true,
      seats_purchased: seatIds.length,
      seats_billed: count,
      seat_ids: seatIds,
      stripe_item_id: stripeItemId,
    });

  } catch (error) {
    console.error('checkoutSeats FATAL:', error?.message || error);
    return Response.json({ ok: false, message: error?.message || 'Server error' }, { status: 500 });
  }
});