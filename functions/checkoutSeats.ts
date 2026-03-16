import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Creates a Stripe Checkout session for N team seats.
 * Body: { count: number }
 * Pre-creates TeamSeat records with status 'pending_payment'.
 * On successful payment (webhook), seats flip to 'open'.
 * Returns a Stripe checkout URL to redirect the user to.
 */
Deno.serve(async (req) => {
  try {
    const base = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
    if (!base) return Response.json({ ok: false, message: 'Server configuration error' }, { status: 500 });

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

    // Get or create Stripe customer
    let customerId = ownerProfile.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripeApi('/customers', {
        'email': user.email,
        'name': ownerProfile.full_name || '',
        'metadata[user_id]': user.id,
        'metadata[app]': 'agentvault',
      });
      customerId = customer.id;
      await base44.asServiceRole.entities.Profile.update(ownerProfile.id, { stripe_customer_id: customerId });
    }

    // Pre-create TeamSeat records with status 'pending_payment'
    const seatIds = [];
    for (let i = 0; i < count; i++) {
      const seat = await base44.asServiceRole.entities.TeamSeat.create({
        owner_profile_id: ownerProfile.id,
        owner_email: user.email.toLowerCase(),
        member_email: '',
        team_role: 'admin',
        status: 'pending_payment',
        invited_at: new Date().toISOString(),
      });
      seatIds.push(seat.id);
    }

    // Create Stripe Checkout session for the seats
    const successUrl = `${base}/BillingSuccess?session_id={CHECKOUT_SESSION_ID}&team=true`;
    const cancelUrl = `${base}/TeamAccount?cancelled=true`;

    const session = await stripeApi('/checkout/sessions', {
      'mode': 'subscription',
      'customer': customerId,
      'customer_update[name]': 'auto',
      'line_items[0][price]': SEAT_PRICE,
      'line_items[0][quantity]': String(count),
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'allow_promotion_codes': 'true',
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan]': 'seats_only',
      'subscription_data[metadata][seat_count]': String(count),
      'subscription_data[metadata][seat_ids]': seatIds.join(','),
      'metadata[user_id]': user.id,
      'metadata[plan]': 'seats_only',
      'metadata[seat_ids]': seatIds.join(','),
    });

    console.log('Seat checkout session created:', session.id, `(${count} seats)`);

    return Response.json({
      ok: true,
      url: session.url,
      session_id: session.id,
      seat_count: count,
    });

  } catch (error) {
    console.error('Checkout seats error:', error);
    return Response.json({ ok: false, message: `Server error: ${error.message}` }, { status: 500 });
  }
});