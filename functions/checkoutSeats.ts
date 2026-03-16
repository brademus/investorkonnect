import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Adds N team seats directly to the owner's existing Stripe subscription.
 * Body: { count: number }
 * No redirect needed — charges are added to the current billing cycle immediately.
 */
Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured' }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'Team seat price not configured. Please contact support.' }, { status: 500 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const count = parseInt(body.count) || 0;
    if (count < 1 || count > 10) return Response.json({ ok: false, message: 'Select between 1 and 10 seats' }, { status: 400 });

    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) return Response.json({ ok: false, message: 'Profile not found' }, { status: 404 });
    const ownerProfile = profiles[0];

    // Must have an active subscription to add seats
    if (!ownerProfile.stripe_subscription_id) {
      return Response.json({ ok: false, message: 'You need an active subscription before adding team seats.' }, { status: 400 });
    }

    // Verify the subscription is active in Stripe
    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${ownerProfile.stripe_subscription_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const subscription = await subResp.json();

    if (!subscription?.id || subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return Response.json({ ok: false, message: 'Your subscription is not active. Please resubscribe first.' }, { status: 400 });
    }

    console.log(`Adding ${count} seats to subscription ${subscription.id} (status: ${subscription.status})`);

    // Check if there's already a seat price item on the subscription
    let existingSeatItem = null;
    for (const item of (subscription.items?.data || [])) {
      if (item.price?.id === SEAT_PRICE) {
        existingSeatItem = item;
        break;
      }
    }

    const seatIds = [];

    // Create TeamSeat records
    for (let i = 0; i < count; i++) {
      const seat = await base44.asServiceRole.entities.TeamSeat.create({
        owner_profile_id: ownerProfile.id,
        owner_email: user.email.toLowerCase(),
        member_email: '',
        team_role: 'member',
        status: 'open',
        invited_at: new Date().toISOString(),
      });
      seatIds.push(seat.id);
    }

    if (seatIds.length === 0) {
      return Response.json({ ok: false, message: 'Failed to create seat records' }, { status: 500 });
    }

    // Add billing to Stripe
    if (existingSeatItem) {
      // Increment the existing seat item quantity
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
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to update seat quantity');

      console.log(`Updated seat item quantity from ${existingSeatItem.quantity} to ${newQty}`);

      for (const seatId of seatIds) {
        await base44.asServiceRole.entities.TeamSeat.update(seatId, {
          stripe_subscription_item_id: existingSeatItem.id,
        });
      }
    } else {
      // No existing seat item — create a new one
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
      if (!resp.ok) throw new Error(data?.error?.message || 'Failed to add seats to subscription');

      console.log(`Created new seat item with quantity ${seatIds.length}: ${data.id}`);

      for (const seatId of seatIds) {
        await base44.asServiceRole.entities.TeamSeat.update(seatId, {
          stripe_subscription_item_id: data.id,
        });
      }
    }

    console.log(`${seatIds.length} seats purchased and billed successfully`);

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