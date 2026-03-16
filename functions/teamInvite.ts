import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * TEAM INVITE — Owner invites a team member by email.
 * Validates domain match, prevents duplicates, invites user to app, sends invitation email.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, team_role } = await req.json();
  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const validRoles = ['admin', 'viewer'];
  const role = validRoles.includes(team_role) ? team_role : 'viewer';

  // Get owner profile
  const profiles = await base44.entities.Profile.filter({ user_id: user.id });
  if (!profiles.length) return Response.json({ error: 'Profile not found' }, { status: 404 });
  const ownerProfile = profiles[0];

  // Domain validation — invitee email must match owner's domain exactly
  const ownerDomain = user.email.split('@')[1]?.toLowerCase();
  const inviteeDomain = normalizedEmail.split('@')[1]?.toLowerCase();

  if (ownerDomain !== inviteeDomain) {
    return Response.json({ 
      error: `Team members must use the same email domain (@${ownerDomain}).` 
    }, { status: 400 });
  }

  // Cannot invite yourself
  if (normalizedEmail === user.email.toLowerCase()) {
    return Response.json({ error: 'You cannot invite yourself' }, { status: 400 });
  }

  // Check for existing seat
  const existing = await base44.entities.TeamSeat.filter({ 
    owner_profile_id: ownerProfile.id, 
    member_email: normalizedEmail 
  });
  if (existing.length && existing[0].status !== 'removed') {
    return Response.json({ error: 'This person has already been invited' }, { status: 400 });
  }

  // Check if invitee is already an owner with their own team or on another team
  const existingMemberships = await base44.asServiceRole.entities.TeamSeat.filter({ member_email: normalizedEmail, status: 'active' });
  if (existingMemberships.length) {
    return Response.json({ error: 'This person is already on another team' }, { status: 400 });
  }

  // Create or reactivate seat
  if (existing.length && existing[0].status === 'removed') {
    await base44.entities.TeamSeat.update(existing[0].id, {
      team_role: role,
      status: 'invited',
      invited_at: new Date().toISOString(),
      member_profile_id: null,
      joined_at: null
    });
  } else {
    await base44.entities.TeamSeat.create({
      owner_profile_id: ownerProfile.id,
      owner_email: user.email.toLowerCase(),
      member_email: normalizedEmail,
      team_role: role,
      status: 'invited',
      invited_at: new Date().toISOString()
    });
  }

  // Invite the user to the app (this sends them a login link email automatically)
  try {
    await base44.users.inviteUser(normalizedEmail, 'user');
  } catch (inviteErr) {
    // User may already exist in the app — that's fine
    console.log('inviteUser result:', inviteErr?.message || 'already exists');
  }

  // Get the seat ID for the invite link
  let seatId = null;
  if (existing.length && existing[0].status === 'invited') {
    seatId = existing[0].id;
  } else {
    // Fetch the just-created seat
    const newSeats = await base44.asServiceRole.entities.TeamSeat.filter({ owner_profile_id: ownerProfile.id, member_email: normalizedEmail, status: 'invited' });
    seatId = newSeats[0]?.id;
  }

  // Send a custom notification email with team context and accept link
  try {
    const inviteUrl = `${appUrl}/AcceptInvite?seatId=${seatId}`;
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedEmail,
      subject: `You've been invited to join ${ownerProfile.full_name || ownerProfile.email}'s team on Investor Konnect`,
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E3C567;">Team Invitation</h2>
          <p><strong>${ownerProfile.full_name || ownerProfile.email}</strong> has invited you to join their team on Investor Konnect as a <strong>${role}</strong>.</p>
          <p>As a team ${role}, you'll ${role === 'admin' ? 'have full access to create, edit, and manage' : 'be able to view'} all of their deals on the dashboard.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:#E3C567;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">View Invitation</a>
          </div>
          <p style="color: #808080; font-size: 13px;">Click the button above to accept or decline the invitation. If you don't have an account yet, you'll be prompted to create one first.</p>
        </div>
      `
    });
  } catch (emailErr) {
    console.error('Failed to send invite email:', emailErr?.message || emailErr);
    // Not a blocker — user was already invited to the app
  }

  return Response.json({ ok: true, message: `Invitation sent to ${normalizedEmail}` });
});