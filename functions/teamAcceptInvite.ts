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
  if (!['accept', 'decline', 'info'].includes(action)) return Response.json({ error: 'action must be accept, decline, or info' }, { status: 400 });

  // Fetch the seat by ID using service role
  let seat = null;
  try {
    seat = await base44.asServiceRole.entities.TeamSeat.get(seat_id);
  } catch (_) {}
  if (!seat) return Response.json({ error: 'Invitation not found' }, { status: 404 });

  // === INFO action — return seat details for the AcceptInvite page ===
  if (action === 'info') {
    // Get owner name
    let ownerName = seat.owner_email || 'Unknown';
    try {
      const owner = await base44.asServiceRole.entities.Profile.get(seat.owner_profile_id);
      if (owner) ownerName = owner.full_name || owner.email || seat.owner_email;
    } catch (_) {}

    const alreadyHandled = seat.status === 'active' ? 'accepted' : seat.status === 'removed' ? 'declined' : null;
    let ownerRole = 'agent';
    try {
      const ownerProf = await base44.asServiceRole.entities.Profile.get(seat.owner_profile_id);
      if (ownerProf?.user_role) ownerRole = ownerProf.user_role;
    } catch (_) {}
    return Response.json({
      ok: true,
      seat: { id: seat.id, status: seat.status, team_role: seat.team_role, member_email: seat.member_email, owner_email: seat.owner_email },
      owner_name: ownerName,
      owner_role: ownerRole,
      already_handled: alreadyHandled,
    });
  }

  // Verify this invite is for the current user
  if (seat.member_email.toLowerCase() !== user.email.toLowerCase()) {
    return Response.json({ error: 'This invitation is not for your account' }, { status: 403 });
  }

  if (seat.status !== 'invited') {
    return Response.json({ error: 'This invitation has already been responded to' }, { status: 400 });
  }

  // Get or create the member's profile
  let memberProfiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
  if (!memberProfiles.length) {
    memberProfiles = await base44.asServiceRole.entities.Profile.filter({ email: user.email.toLowerCase() });
  }
  let memberProfile = memberProfiles[0];

  // Auto-create profile for brand new users
  if (!memberProfile) {
    memberProfile = await base44.asServiceRole.entities.Profile.create({
      user_id: user.id,
      email: user.email.toLowerCase(),
      full_name: user.full_name || user.email.split('@')[0],
    });
    console.log('Auto-created profile for new team member:', user.email);
  }

  if (action === 'decline') {
    await base44.asServiceRole.entities.TeamSeat.update(seat.id, { status: 'removed' });
    return Response.json({ ok: true, action: 'declined', message: 'Invitation declined.' });
  }

  // === ACCEPT ===

  // Role-match validation: member must be the same role as the team owner
  let ownerProfile = null;
  try { ownerProfile = await base44.asServiceRole.entities.Profile.get(seat.owner_profile_id); } catch (_) {}
  if (ownerProfile && memberProfile.user_role && ownerProfile.user_role) {
    if (memberProfile.user_role !== ownerProfile.user_role) {
      return Response.json({ 
        error: `This team is for ${ownerProfile.user_role}s only. Your account is registered as an ${memberProfile.user_role}.` 
      }, { status: 400 });
    }
  }

  // 1) Activate the seat
  await base44.asServiceRole.entities.TeamSeat.update(seat.id, {
    status: 'active',
    member_profile_id: memberProfile.id,
    member_name: memberProfile.full_name || user.full_name || user.email,
    joined_at: new Date().toISOString()
  });

  // 2) Link this profile to the team owner, and inherit owner's role if member doesn't have one
  const profileUpdate = { team_owner_id: seat.owner_profile_id };
  if ((!memberProfile.user_role || memberProfile.user_role === 'member') && ownerProfile?.user_role) {
    profileUpdate.user_role = ownerProfile.user_role;
    profileUpdate.user_type = ownerProfile.user_role;
    console.log('Set member role to match owner:', ownerProfile.user_role);
  }
  await base44.asServiceRole.entities.Profile.update(memberProfile.id, profileUpdate);

  // 3) Add $10/mo seat to owner's Stripe subscription
  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE_ID = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');

    if (STRIPE_SECRET_KEY && SEAT_PRICE_ID) {
      // Get owner profile to find their Stripe subscription (reuse if already fetched)
      let billingOwner = ownerProfile;
      if (!billingOwner) {
        try { billingOwner = await base44.asServiceRole.entities.Profile.get(seat.owner_profile_id); } catch (_) {}
      }

      if (billingOwner?.stripe_subscription_id) {
        // Fetch the subscription to get its items
        const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${billingOwner.stripe_subscription_id}`, {
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