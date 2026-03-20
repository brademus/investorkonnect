import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * TEAM MANAGE — List, assign, remove member, cancel seat, update role, accept invite.
 * 
 * LIST action uses Stripe as source of truth for paid seat count,
 * then reconciles local TeamSeat records to match.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  const profiles = await base44.entities.Profile.filter({ user_id: user.id });
  if (!profiles.length) return Response.json({ error: 'Profile not found' }, { status: 404 });
  const myProfile = profiles[0];

  // === LIST ===
  if (action === 'list') {
    const isAgent = myProfile.user_role === 'agent';

    // Agents get free seats — no Stripe reconciliation needed
    if (isAgent) {
      const ownedSeats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
      const activeSeats = ownedSeats.filter(s => s.status === 'open' || s.status === 'invited' || s.status === 'active');

      const myMembership = await base44.entities.TeamSeat.filter({ member_email: user.email.toLowerCase() });
      const activeMembership = myMembership.find(s => s.status === 'active' || s.status === 'invited');

      return Response.json({
        ok: true,
        seats: activeSeats,
        stripe_paid_seats: 0,
        free_seats: true,
        my_membership: activeMembership || null,
        is_owner: activeSeats.length > 0 || !activeMembership,
      });
    }

    // Investors: Stripe is source of truth for paid seats
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const SEAT_PRICE_ID = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');
    const subId = myProfile.stripe_subscription_id;

    // 1. Get paid seat count from Stripe (source of truth)
    let stripePaidSeats = 0;
    if (STRIPE_SECRET_KEY && SEAT_PRICE_ID && subId) {
      try {
        const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
        });
        if (subResp.ok) {
          const sub = await subResp.json();
          const seatItem = (sub.items?.data || []).find(item => item.price?.id === SEAT_PRICE_ID);
          if (seatItem) {
            stripePaidSeats = seatItem.quantity || 0;
          }
        }
      } catch (err) {
        console.error('Failed to fetch Stripe subscription for seat count:', err?.message);
      }
    }

    // 2. Fetch existing local seat records
    const ownedSeats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    // Only count seats that are actually usable (open, invited, active) — NOT pending_payment or removed
    const activeSeats = ownedSeats.filter(s => s.status === 'open' || s.status === 'invited' || s.status === 'active');
    const localSeatCount = activeSeats.length;

    // 3. Reconcile: create missing seats or mark extras as removed
    if (stripePaidSeats > localSeatCount) {
      const toCreate = stripePaidSeats - localSeatCount;
      console.log(`Reconciling: Stripe has ${stripePaidSeats} paid seats, local has ${localSeatCount}. Creating ${toCreate} seats.`);
      const stripeItemId = myProfile.stripe_seat_item_id || '';
      const delay = (ms) => new Promise(r => setTimeout(r, ms));

      for (let i = 0; i < toCreate; i++) {
        if (i > 0) await delay(300);
        try {
          await base44.asServiceRole.entities.TeamSeat.create({
            owner_profile_id: myProfile.id,
            owner_email: user.email.toLowerCase(),
            member_email: '',
            team_role: 'member',
            status: 'open',
            invited_at: new Date().toISOString(),
            stripe_subscription_item_id: stripeItemId,
          });
        } catch (err) {
          console.error(`Failed to create reconciliation seat ${i + 1}:`, err?.message);
          break;
        }
      }
    } else if (stripePaidSeats < localSeatCount) {
      // More local seats than Stripe has — remove unassigned open seats first, then unpaid invited seats
      const excess = localSeatCount - stripePaidSeats;
      const openSeats = activeSeats.filter(s => s.status === 'open');
      const unpaidInvited = activeSeats.filter(s => s.status === 'invited' && !s.stripe_subscription_item_id);
      const candidates = [...openSeats, ...unpaidInvited];
      const seatsToRemove = candidates.slice(0, excess);
      console.log(`Reconciling: Stripe has ${stripePaidSeats} paid seats, local has ${localSeatCount}. Removing ${seatsToRemove.length} excess seats.`);
      for (const seat of seatsToRemove) {
        try {
          await base44.entities.TeamSeat.update(seat.id, { status: 'removed' });
        } catch (_) {}
      }
    }

    // Clear any stale pending_seats_count
    if (myProfile.pending_seats_count > 0) {
      try {
        await base44.asServiceRole.entities.Profile.update(myProfile.id, { pending_seats_count: 0 });
      } catch (_) {}
    }

    // 4. Re-fetch after reconciliation
    const finalSeats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const finalActive = finalSeats.filter(s => s.status === 'open' || s.status === 'invited' || s.status === 'active');

    const myMembership = await base44.entities.TeamSeat.filter({ member_email: user.email.toLowerCase() });
    const activeMembership = myMembership.find(s => s.status === 'active' || s.status === 'invited');

    return Response.json({
      ok: true,
      seats: finalActive,
      stripe_paid_seats: stripePaidSeats,
      free_seats: false,
      my_membership: activeMembership || null,
      is_owner: finalActive.length > 0 || !activeMembership,
    });
  }

  // === ADD FREE SEATS (agents only) ===
  if (action === 'add_free_seats') {
    if (myProfile.user_role !== 'agent') {
      return Response.json({ error: 'Free seats are only available for agents' }, { status: 403 });
    }
    const count = parseInt(body.count) || 0;
    if (count < 1 || count > 10) return Response.json({ error: 'Select between 1 and 10 seats' }, { status: 400 });

    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < count; i++) {
      if (i > 0) await delay(300);
      await base44.asServiceRole.entities.TeamSeat.create({
        owner_profile_id: myProfile.id,
        owner_email: user.email.toLowerCase(),
        member_email: '',
        team_role: 'member',
        status: 'open',
        invited_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, seats_added: count });
  }

  // === ASSIGN — assign an email to an open seat, send invite ===
  if (action === 'assign') {
    const { seat_id, email } = body;
    if (!seat_id || !email) return Response.json({ error: 'seat_id and email required' }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();

    const seats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const seat = seats.find(s => s.id === seat_id);
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 });
    if (seat.status !== 'open') return Response.json({ error: 'This seat is not available for assignment' }, { status: 400 });

    const ownerDomain = user.email.split('@')[1]?.toLowerCase();
    const inviteeDomain = normalizedEmail.split('@')[1]?.toLowerCase();
    if (ownerDomain !== inviteeDomain) {
      return Response.json({ error: `Team members must use @${ownerDomain} email addresses.` }, { status: 400 });
    }
    if (normalizedEmail === user.email.toLowerCase()) {
      return Response.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    const existingOnTeam = seats.find(s => s.member_email === normalizedEmail && s.status !== 'removed' && s.status !== 'open');
    if (existingOnTeam) {
      return Response.json({ error: 'This person is already on your team' }, { status: 400 });
    }

    const ownerRole = myProfile.user_role;
    const inviteeProfiles = await base44.asServiceRole.entities.Profile.filter({ email: normalizedEmail });
    if (inviteeProfiles.length > 0) {
      const inviteeRole = inviteeProfiles[0].user_role;
      if (inviteeRole && inviteeRole !== ownerRole) {
        const ownerLabel = ownerRole === 'investor' ? 'Investors' : 'Agents';
        return Response.json({
          error: `${ownerLabel} can only invite other ${ownerRole}s to their team. This person is an ${inviteeRole}.`
        }, { status: 400 });
      }
    }

    await base44.entities.TeamSeat.update(seat_id, {
      member_email: normalizedEmail,
      status: 'invited',
      invited_at: new Date().toISOString(),
    });

    // 1) Ensure user has an app account first (required before SendEmail works)
    try {
      await base44.users.inviteUser(normalizedEmail, 'user');
      console.log('inviteUser succeeded for', normalizedEmail);
    } catch (inviteErr) {
      console.log('inviteUser:', inviteErr?.message || 'already exists');
    }

    // Small delay to ensure account is propagated before sending custom email
    await new Promise(r => setTimeout(r, 2000));

    // 2) Send custom team invitation email with direct AcceptInvite link
    const ownerName = myProfile.full_name || user.email;
    try {
      const appUrl = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
      const inviteUrl = `${appUrl}/AcceptInvite?seatId=${seat_id}`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: normalizedEmail,
        from_name: 'Investor Konnect',
        subject: `${ownerName} invited you to join their team`,
        body: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D0D0D; border-radius: 16px; overflow: hidden; border: 1px solid #1F1F1F;">
            <div style="padding: 40px 32px; text-align: center;">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2a5ae75f8_616CA829-4C69-40A9-8555-BE50375B7FC6.png" alt="Investor Konnect" width="48" height="48" style="margin-bottom: 16px;" />
              <h1 style="color: #E3C567; font-size: 26px; margin: 0 0 16px 0; font-family: Georgia, serif;">Team Invitation</h1>
              <p style="color: #FAFAFA; font-size: 16px; line-height: 1.5; margin: 0 0 8px 0;">
                <strong>${ownerName}</strong> has invited you to join their team on Investor Konnect.
              </p>
              <div style="background: #141414; border: 1px solid #1F1F1F; border-radius: 12px; padding: 16px; margin: 20px 0;">
                <p style="color: #808080; font-size: 13px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px;">Your Role</p>
                <p style="color: #E3C567; font-size: 18px; font-weight: bold; margin: 0;">🔑 Team Member — Full deal access</p>
              </div>
              <a href="${inviteUrl}" style="display: inline-block; padding: 16px 48px; background: #E3C567; color: #000; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 8px 0 24px 0;">
                Accept or Decline Invitation
              </a>
              <p style="color: #666; font-size: 12px; line-height: 1.5;">
                Click the button above to review and respond to this invitation.<br/>
                You'll complete a quick setup: verify your identity and sign the platform agreement.
              </p>
              <hr style="border: none; border-top: 1px solid #1F1F1F; margin: 24px 0 16px 0;" />
              <p style="color: #444; font-size: 11px;">
                If you received this email by mistake, you can safely ignore it.
              </p>
            </div>
          </div>
        `
      });
      console.log('Custom team invite email sent to', normalizedEmail);
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr?.message);
      console.error('Error data:', JSON.stringify(emailErr?.response?.data || emailErr));
    }

    return Response.json({ ok: true, message: `Invite sent to ${normalizedEmail}` });
  }

  // === REMOVE MEMBER — free the seat but keep billing (seat becomes 'open') ===
  if (action === 'remove_member') {
    const { seat_id } = body;
    if (!seat_id) return Response.json({ error: 'seat_id required' }, { status: 400 });

    const seats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const seat = seats.find(s => s.id === seat_id);
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 });

    await base44.entities.TeamSeat.update(seat_id, {
      status: 'open',
      member_email: '',
      member_profile_id: null,
      member_name: null,
      joined_at: null,
    });

    if (seat.member_profile_id) {
      try {
        await base44.asServiceRole.entities.Profile.update(seat.member_profile_id, {
          team_owner_id: null,
          subscription_status: null,
        });
      } catch (_) {}
    }

    return Response.json({ ok: true, message: 'Member removed — seat is now available' });
  }

  // === CANCEL SEAT — stop billing and remove the seat entirely ===
  if (action === 'cancel_seat') {
    const { seat_id } = body;
    if (!seat_id) return Response.json({ error: 'seat_id required' }, { status: 400 });

    const seats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const seat = seats.find(s => s.id === seat_id);
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 });

    if (seat.member_profile_id) {
      try {
        await base44.asServiceRole.entities.Profile.update(seat.member_profile_id, {
          team_owner_id: null,
          subscription_status: null,
        });
      } catch (_) {}
    }

    await base44.entities.TeamSeat.update(seat_id, { status: 'removed' });

    // Decrement Stripe quantity
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    if (STRIPE_SECRET_KEY) {
      try {
        const allSeats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
        const remainingSeats = allSeats.filter(s => s.id !== seat_id && s.status !== 'removed').length;

        const SEAT_PRICE_ID = Deno.env.get('STRIPE_PRICE_TEAM_SEAT');
        const subId = myProfile.stripe_subscription_id;

        if (subId && SEAT_PRICE_ID) {
          const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
            headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
          });
          const sub = await subResp.json();

          if (sub?.items?.data) {
            for (const item of sub.items.data) {
              if (item.price?.id === SEAT_PRICE_ID) {
                if (remainingSeats <= 0) {
                  await fetch(`https://api.stripe.com/v1/subscription_items/${item.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ 'proration_behavior': 'create_prorations' }).toString(),
                  });
                  console.log('Deleted seat subscription item (no seats remaining)');
                } else if (item.quantity > remainingSeats) {
                  await fetch(`https://api.stripe.com/v1/subscription_items/${item.id}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ 'quantity': String(remainingSeats), 'proration_behavior': 'create_prorations' }).toString(),
                  });
                  console.log(`Decremented seat quantity to ${remainingSeats}`);
                }
                break;
              }
            }
          }
        }
      } catch (billingErr) {
        console.error('Billing cancellation error (non-fatal):', billingErr?.message);
      }
    }

    return Response.json({ ok: true, message: 'Seat cancelled' });
  }

  // === LEGACY REMOVE ===
  if (action === 'remove') {
    const { seat_id } = body;
    if (!seat_id) return Response.json({ error: 'seat_id required' }, { status: 400 });

    const seats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const seat = seats.find(s => s.id === seat_id);
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 });

    if (seat.member_profile_id) {
      try {
        await base44.asServiceRole.entities.Profile.update(seat.member_profile_id, {
          team_owner_id: null,
          subscription_status: null,
        });
      } catch (_) {}
    }

    await base44.entities.TeamSeat.update(seat_id, { status: 'removed' });
    return Response.json({ ok: true, message: 'Team member removed' });
  }

  // === UPDATE ROLE ===
  if (action === 'updateRole') {
    const { seat_id, team_role } = body;
    if (!seat_id || !['admin', 'member', 'viewer'].includes(team_role)) {
      return Response.json({ error: 'seat_id and valid team_role required' }, { status: 400 });
    }
    const seats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const seat = seats.find(s => s.id === seat_id);
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 });

    await base44.entities.TeamSeat.update(seat_id, { team_role });
    return Response.json({ ok: true, message: `Role updated to ${team_role}` });
  }

  // === ACCEPT INVITE ===
  if (action === 'accept') {
    const myMemberships = await base44.entities.TeamSeat.filter({ member_email: user.email.toLowerCase(), status: 'invited' });
    if (!myMemberships.length) return Response.json({ error: 'No pending invitation found' }, { status: 404 });

    const seat = myMemberships[0];
    await base44.entities.TeamSeat.update(seat.id, {
      status: 'active',
      member_profile_id: myProfile.id,
      member_name: myProfile.full_name || user.email,
      joined_at: new Date().toISOString(),
    });

    await base44.entities.Profile.update(myProfile.id, { team_owner_id: seat.owner_profile_id });

    return Response.json({ ok: true, message: 'You have joined the team!' });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
});