import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * TEAM ACCEPT/DECLINE INVITE
 * - Accepts or declines a team seat invitation
 * - On accept: activates the seat, links profile, and adds a $10/mo seat line item to owner's Stripe subscription
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { seat_id, action } = await req.json();
  if (!seat_id) return Response.json({ error: 'seat_id required' }, { status: 400 });
  if (!['accept', 'decline'].includes(action)) return Response.json({ error: 'action must be accept or decline' }, { status: 400 });

  // Fetch the seat
  const seats = await base44.asServiceRole.entities.TeamSeat.filter({ id: seat_id });
  if (!seats.length) return Response.json({ error: 'Invitation not found' }, { status: 404 });
  const seat = seats[0];

  // Verify this invite is for the current user
  if (seat.member_email.toLowerCase() !== user.email.toLowerCase()) {
    return Response.json({ error: 'This invitation is not for your account' }, { status: 403 });
  }

  if (seat.status !== 'invited') {
    return Response.json({ error: 'This invitation has already been responded to' }, { status: 400 });
  }

  // Get or create the member's profile
  let memberProfiles = await base44.entities.Profile.filter({ user_id: user.id });
  if (!memberProfiles.length) {
    memberProfiles = await base44.entities.Profile.filter({ email: user.email.toLowerCase() });
  }
  const memberProfile = memberProfiles[0];
  if (!memberProfile) return Response.json({ error: 'Your profile was not found. Please complete setup first.' }, { status: 404 });

  if (action === 'decline') {
    await base44.asServiceRole.entities.TeamSeat.update(seat.id, { status: 'removed' });
    return Response.json({ ok: true, action: 'declined', message: 'Invitation declined.' });
  }

  // === ACCEPT ===

  // 1) Activate the seat
  await base44.asServiceRole.entities.TeamSeat.update(seat.id, {
    status: 'active',
    member_profile_id: memberProfile.id,
    member_name: memberProfile.full_name || user.full_name || user.email,
    joined_at: new Date().toISOString()
  });

  // 2) Link this profile to the team owner
  await base44.asServiceRole.entities.Profile.update(memberProfile.id, {
    team_owner_id: seat.owner_profile_id
  });

  // 3) Add $10/mo seat to owner's Stripe subscription
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE_ID = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (STRIPE_SECRET_KEY && SEAT_PRICE_ID) {
      // Get owner profile to find their Stripe subscription
      const ownerProfiles = await base44.asServiceRole.entities.Profile.filter({ id: seat.owner_profile_id });
      const ownerProfile = ownerProfiles[0];

      if (ownerProfile?.stripe_subscription_id) {
        // Fetch the subscription to get its items
        const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${ownerProfile.stripe_subscription_id}`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
        });
        const subscription = await subResp.json();

        if (subscription?.id && subscription.status !== 'canceled') {
          // Add a new line item for the team seat
          const addResp = await fetch(`https://api.stripe.com/v1/subscription_items`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              'subscription': subscription.id,
              'price': SEAT_PRICE_ID,
              'quantity': '1',
              'metadata[seat_id]': seat.id,
              'metadata[member_email]': seat.member_email,
              'proration_behavior': 'create_prorations',
            }).toString(),
          });
          const itemData = await addResp.json();

          if (itemData?.id) {
            console.log('✅ Added seat line item to subscription:', itemData.id);
            // Store the subscription item ID on the seat for future removal
            await base44.asServiceRole.entities.TeamSeat.update(seat.id, {
              stripe_subscription_item_id: itemData.id
            });
          } else {
            console.error('Failed to add seat to subscription:', itemData?.error?.message);
          }
        }
      } else {
        console.warn('Owner has no active Stripe subscription — seat added without billing');
      }
    } else {
      console.warn('STRIPE_PRICE_TEAM_SEAT not configured — seat added without billing');
    }
  } catch (billingErr) {
    console.error('Billing error (non-fatal):', billingErr?.message || billingErr);
    // Non-fatal — seat is still activated
  }

  return Response.json({ ok: true, action: 'accepted', message: 'You have joined the team!' });
});