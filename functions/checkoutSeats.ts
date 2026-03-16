import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * CHECKOUT SEATS — Adds team seat billing to the owner's Stripe subscription.
 * Body: { count: number }
 * 
 * Only 3 Base44 SDK calls (auth, profile filter, profile update) to avoid 429.
 * Stripe calls are direct fetch. Seat records created lazily by teamManage list.
 * Returns diagnostic info for troubleshooting.
 */
Deno.serve(async (req) => {
  const diag = { step: 'init', stripe_key_type: '', price_id: '', sub_id: '', stripe_response: null };

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    diag.stripe_key_type = STRIPE_SECRET_KEY ? (STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN') : 'NOT_SET';
    diag.price_id = SEAT_PRICE || 'NOT_SET';

    if (!STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe not configured', diag }, { status: 500 });
    if (!SEAT_PRICE) return Response.json({ ok: false, message: 'STRIPE_PRICE_TEAM_SEAT env var is not set', diag }, { status: 500 });

    diag.step = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, message: 'Unauthorized', diag }, { status: 401 });

    const body = await req.json();
    const count = parseInt(body.count) || 0;
    if (count < 1 || count > 10) return Response.json({ ok: false, message: 'Select between 1 and 10 seats', diag }, { status: 400 });

    diag.step = 'profile';
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) return Response.json({ ok: false, message: 'Profile not found', diag }, { status: 404 });
    const ownerProfile = profiles[0];

    diag.sub_id = ownerProfile.stripe_subscription_id || 'NOT_SET';

    if (!ownerProfile.stripe_subscription_id) {
      return Response.json({ ok: false, message: 'No stripe_subscription_id on your profile. Subscribe first.', diag }, { status: 400 });
    }

    diag.step = 'fetch_subscription';
    const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${ownerProfile.stripe_subscription_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const subRespText = await subResp.text();
    let subscription;
    try { subscription = JSON.parse(subRespText); } catch (_) { subscription = null; }

    if (!subResp.ok) {
      diag.stripe_response = { status: subResp.status, body: subRespText.slice(0, 500) };
      return Response.json({ ok: false, message: `Stripe returned ${subResp.status} when fetching subscription. Check if sub ID "${ownerProfile.stripe_subscription_id}" is valid in ${diag.stripe_key_type} mode.`, diag }, { status: 400 });
    }

    if (!subscription?.id || subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return Response.json({ ok: false, message: `Subscription status is "${subscription?.status}". It must be active.`, diag }, { status: 400 });
    }

    diag.step = 'add_seats';
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
      const respText = await resp.text();
      let data;
      try { data = JSON.parse(respText); } catch (_) { data = null; }

      diag.stripe_response = { status: resp.status, ok: resp.ok, item_id: data?.id, quantity: data?.quantity, error: data?.error?.message };

      if (!resp.ok) {
        return Response.json({ ok: false, message: `Stripe billing failed (update qty): ${data?.error?.message || respText.slice(0, 200)}`, diag }, { status: 500 });
      }
      stripeItemId = existingSeatItem.id;
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
      const respText = await resp.text();
      let data;
      try { data = JSON.parse(respText); } catch (_) { data = null; }

      diag.stripe_response = { status: resp.status, ok: resp.ok, item_id: data?.id, quantity: data?.quantity, error: data?.error?.message };

      if (!resp.ok) {
        return Response.json({ ok: false, message: `Stripe billing failed (create item): ${data?.error?.message || respText.slice(0, 200)}`, diag }, { status: 500 });
      }
      stripeItemId = data.id;
    }

    diag.step = 'save_pending';
    const existingPending = ownerProfile.pending_seats_count || 0;
    await base44.asServiceRole.entities.Profile.update(ownerProfile.id, {
      pending_seats_count: existingPending + count,
      stripe_seat_item_id: stripeItemId,
    });

    diag.step = 'done';

    return Response.json({
      ok: true,
      seats_purchased: count,
      stripe_item_id: stripeItemId,
      diag,
    });

  } catch (error) {
    diag.step = 'fatal_error';
    return Response.json({ ok: false, message: error?.message || 'Server error', diag }, { status: 500 });
  }
});