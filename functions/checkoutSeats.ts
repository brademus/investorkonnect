import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Adds N team seats to the owner's existing subscription.
 * Body: { count: number }
 * Creates TeamSeat records with status 'open' (no email assigned yet).
 * Adds $10/mo line items directly to the existing Stripe subscription.
 */
Deno.serve(async (req) => {
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured' }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'Team seat price not configured' }, { status: 500 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const count = parseInt(body.count) || 0;
    if (count < 1 || count > 10) return Response.json({ ok: false, message: 'Select between 1 and 10 seats' }, { status: 400 });

    // Get owner profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) return Response.json({ ok: false, message: 'Profile not found' }, { status: 404 });
    const ownerProfile = profiles[0];

    if (!ownerProfile.stripe_subscription_id) {
      return Response.json({ ok: false, message: 'You need an active subscription first' }, { status: 400 });
    }

    // Stripe helper
    const stripeApi = async (endpoint, params) => {
      const resp = await fetch(`https://api.stripe.com/v1${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || `Stripe error ${resp.status}`);
      return data;
    };

    // Create seats and add billing line items
    const seatIds = [];
    for (let i = 0; i < count; i++) {
      const seat = await base44.asServiceRole.entities.TeamSeat.create({
        owner_profile_id: ownerProfile.id,
        owner_email: user.email.toLowerCase(),
        member_email: '',
        team_role: 'admin',
        status: 'open',
        invited_at: new Date().toISOString(),
      });

      try {
        const item = await stripeApi('/subscription_items', {
          'subscription': ownerProfile.stripe_subscription_id,
          'price': SEAT_PRICE,
          'quantity': '1',
          'metadata[seat_id]': seat.id,
          'proration_behavior': 'create_prorations',
        });

        await base44.asServiceRole.entities.TeamSeat.update(seat.id, {
          stripe_subscription_item_id: item.id,
        });

        seatIds.push(seat.id);
        console.log(`Seat ${seat.id} added to subscription, item: ${item.id}`);
      } catch (stripeErr) {
        console.error(`Failed to add seat ${seat.id} to subscription:`, stripeErr?.message);
        await base44.asServiceRole.entities.TeamSeat.update(seat.id, { status: 'removed' });
      }
    }

    console.log(`${seatIds.length}/${count} seats purchased successfully`);

    return Response.json({
      ok: true,
      seats_purchased: seatIds.length,
      seat_ids: seatIds,
    });

  } catch (error) {
    console.error('Checkout seats error:', error);
    return Response.json({ ok: false, message: `Server error: ${error.message}` }, { status: 500 });
  }
});