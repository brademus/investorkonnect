import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * TEAM INVITE — Owner invites a team member by email.
 * Validates domain match, prevents duplicates, sends invitation email.
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

  // Domain validation — extract domain from owner and invitee
  const ownerDomain = user.email.split('@')[1]?.toLowerCase();
  const inviteeDomain = normalizedEmail.split('@')[1]?.toLowerCase();
  
  // Skip domain check for common free email providers (allow mixed teams)
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com'];
  const ownerIsFree = freeProviders.includes(ownerDomain);
  const inviteeIsFree = freeProviders.includes(inviteeDomain);

  // If owner uses a company domain, invitee must match (unless invitee is free email)
  if (!ownerIsFree && !inviteeIsFree && ownerDomain !== inviteeDomain) {
    return Response.json({ 
      error: `Team members must use the same company email domain (@${ownerDomain}). Use a matching email or contact support.` 
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

  // Send invitation email
  try {
    const appUrl = Deno.env.get('PUBLIC_APP_URL') || '';
    await base44.integrations.Core.SendEmail({
      to: normalizedEmail,
      subject: `You've been invited to join ${ownerProfile.full_name}'s team on Investor Konnect`,
      body: `
        <h2>Team Invitation</h2>
        <p><strong>${ownerProfile.full_name}</strong> has invited you to join their team on Investor Konnect as a <strong>${role}</strong>.</p>
        <p>As a team member, you'll have access to their shared deal board and pipeline.</p>
        <p><a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#E3C567;color:#000;border-radius:8px;text-decoration:none;font-weight:bold;">Accept Invitation</a></p>
        <p>If you don't have an account yet, you'll be prompted to create one when you click the link.</p>
      `
    });
  } catch (emailErr) {
    console.error('Failed to send invite email:', emailErr);
  }

  return Response.json({ ok: true, message: `Invitation sent to ${normalizedEmail}` });
});