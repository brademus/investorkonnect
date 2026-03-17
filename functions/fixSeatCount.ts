import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * ADMIN FIX: Corrects Stripe seat quantity to match desired count.
 * Body: { target_quantity }
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const profiles = await base44.entities.Profile.filter({ user_id: user.id });
  if (!profiles.length) return Response.json({ error: 'No profile' }, { status: 404 });
  const profile = profiles[0];

  if (user.role !== 'admin' && profile.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const targetQty = parseInt(body.target_quantity);
  if (isNaN(targetQty) || targetQty < 0) return Response.json({ error: 'target_quantity must be >= 0' }, { status: 400 });

  const ownerProfileId = body.owner_profile_id || profile.id;

  // Find owner profile
  let ownerProfile = profile;
  if (ownerProfileId !== profile.id) {
    const owners = await base44.asServiceRole.entities.Profile.filter({ id: ownerProfileId });
    if (!owners.length) return Response.json({ error: 'Owner profile not found' }, { status: 404 });
    ownerProfile = owners[0];
  }

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
  const SEAT_PRICE_ID = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');
  const subId = ownerProfile.stripe_subscription_id;

  if (!STRIPE_SECRET_KEY || !SEAT_PRICE_ID || !subId) {
    return Response.json({ error: 'Missing Stripe config or subscription' }, { status: 400 });
  }

  // 1. Get current Stripe subscription
  const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!subResp.ok) return Response.json({ error: 'Failed to fetch subscription' }, { status: 500 });
  const sub = await subResp.json();

  const seatItem = (sub.items?.data || []).find(item => item.price?.id === SEAT_PRICE_ID);
  if (!seatItem) return Response.json({ error: 'No seat line item found on subscription', current_items: sub.items?.data?.map(i => ({ id: i.id, price: i.price?.id, qty: i.quantity })) }, { status: 404 });

  const currentQty = seatItem.quantity;
  console.log(`Current Stripe seat quantity: ${currentQty}, target: ${targetQty}`);

  // 2. Update Stripe quantity
  if (targetQty === 0) {
    // Delete the line item entirely
    const delResp = await fetch(`https://api.stripe.com/v1/subscription_items/${seatItem.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'proration_behavior': 'create_prorations' }).toString(),
    });
    if (!delResp.ok) {
      const err = await delResp.json();
      return Response.json({ error: `Stripe delete error: ${err?.error?.message}` }, { status: 500 });
    }
    console.log('Deleted seat line item from Stripe');
  } else {
    const updResp = await fetch(`https://api.stripe.com/v1/subscription_items/${seatItem.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'quantity': String(targetQty), 'proration_behavior': 'create_prorations' }).toString(),
    });
    if (!updResp.ok) {
      const err = await updResp.json();
      return Response.json({ error: `Stripe update error: ${err?.error?.message}` }, { status: 500 });
    }
    const updated = await updResp.json();
    console.log(`Updated Stripe seat quantity to ${updated.quantity}`);
  }

  // 3. Clean up local TeamSeat records to match
  const allSeats = await base44.asServiceRole.entities.TeamSeat.filter({ owner_profile_id: ownerProfileId });
  const activeSeats = allSeats.filter(s => s.status === 'open' || s.status === 'invited' || s.status === 'active');
  
  // Remove excess seats (keep assigned ones first, remove open ones)
  if (activeSeats.length > targetQty) {
    const excess = activeSeats.length - targetQty;
    const openSeats = activeSeats.filter(s => s.status === 'open');
    const toRemove = openSeats.slice(0, excess);
    for (const seat of toRemove) {
      await base44.asServiceRole.entities.TeamSeat.update(seat.id, { status: 'removed' });
    }
    console.log(`Removed ${toRemove.length} excess local seats`);
  }

  return Response.json({
    ok: true,
    previous_stripe_qty: currentQty,
    new_stripe_qty: targetQty,
    message: `Stripe seat quantity updated from ${currentQty} to ${targetQty}`,
  });
});