import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * TEAM MANAGE — List team, remove member, update role.
 * Actions: list, remove, updateRole
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  // Get caller profile
  const profiles = await base44.entities.Profile.filter({ user_id: user.id });
  if (!profiles.length) return Response.json({ error: 'Profile not found' }, { status: 404 });
  const myProfile = profiles[0];

  if (action === 'list') {
    // Return seats where I am the owner
    const ownedSeats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const activeSeats = ownedSeats.filter(s => s.status !== 'removed');
    
    // Also check if I'm a member of someone else's team
    const myMembership = await base44.entities.TeamSeat.filter({ member_email: user.email.toLowerCase() });
    const activeMembership = myMembership.find(s => s.status === 'active' || s.status === 'invited');

    return Response.json({ 
      ok: true, 
      seats: activeSeats,
      my_membership: activeMembership || null,
      is_owner: activeSeats.length > 0 || !activeMembership
    });
  }

  if (action === 'remove') {
    const { seat_id } = body;
    if (!seat_id) return Response.json({ error: 'seat_id required' }, { status: 400 });

    // Verify ownership
    const seats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const seat = seats.find(s => s.id === seat_id);
    if (!seat) return Response.json({ error: 'Seat not found or not yours' }, { status: 404 });

    await base44.entities.TeamSeat.update(seat_id, { status: 'removed' });
    
    // If the member had a profile, clear their team association
    if (seat.member_profile_id) {
      try {
        await base44.asServiceRole.entities.Profile.update(seat.member_profile_id, { team_owner_id: null });
      } catch (_) {}
    }

    return Response.json({ ok: true, message: 'Team member removed' });
  }

  if (action === 'updateRole') {
    const { seat_id, team_role } = body;
    if (!seat_id || !['admin', 'viewer'].includes(team_role)) {
      return Response.json({ error: 'seat_id and valid team_role required' }, { status: 400 });
    }

    const seats = await base44.entities.TeamSeat.filter({ owner_profile_id: myProfile.id });
    const seat = seats.find(s => s.id === seat_id);
    if (!seat) return Response.json({ error: 'Seat not found or not yours' }, { status: 404 });

    await base44.entities.TeamSeat.update(seat_id, { team_role });
    return Response.json({ ok: true, message: `Role updated to ${team_role}` });
  }

  if (action === 'accept') {
    // Accept a pending invitation
    const myMemberships = await base44.entities.TeamSeat.filter({ member_email: user.email.toLowerCase(), status: 'invited' });
    if (!myMemberships.length) return Response.json({ error: 'No pending invitation found' }, { status: 404 });

    const seat = myMemberships[0];
    await base44.entities.TeamSeat.update(seat.id, {
      status: 'active',
      member_profile_id: myProfile.id,
      member_name: myProfile.full_name || user.email,
      joined_at: new Date().toISOString()
    });

    // Store team_owner_id on the member's profile for quick lookup
    await base44.entities.Profile.update(myProfile.id, { team_owner_id: seat.owner_profile_id });

    return Response.json({ ok: true, message: 'You have joined the team!' });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
});