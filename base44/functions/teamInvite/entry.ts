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

  // Team accounts are investors-only
  if (ownerProfile.user_role === 'agent') {
    return Response.json({ error: 'Team accounts are only available for investors' }, { status: 403 });
  }

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

  // Role-match validation: investors can only invite investors, agents can only invite agents
  const inviteeProfiles = await base44.asServiceRole.entities.Profile.filter({ email: normalizedEmail });
  if (inviteeProfiles.length > 0) {
    const inviteeRole = inviteeProfiles[0].user_role;
    if (inviteeRole && inviteeRole !== ownerProfile.user_role) {
      return Response.json({ 
        error: `Your team is for ${ownerProfile.user_role}s only. This person is registered as an ${inviteeRole}.` 
      }, { status: 400 });
    }
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

  // Get the seat ID for the invite link
  let seatId = null;
  if (existing.length && existing[0].status === 'invited') {
    seatId = existing[0].id;
  } else {
    // Fetch the just-created seat
    const newSeats = await base44.asServiceRole.entities.TeamSeat.filter({ owner_profile_id: ownerProfile.id, member_email: normalizedEmail, status: 'invited' });
    seatId = newSeats[0]?.id;
  }

  const appUrl = String(Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/+$/, '');
  const acceptPageUrl = `/AcceptInvite?seatId=${seatId}`;
  const fullInviteUrl = `${appUrl}${acceptPageUrl}`;

  // 1) First, ensure the user has an app account (inviteUser creates one if needed).
  //    We do this BEFORE our custom email so the account exists when they click our link.
  //    The platform may send its own generic "Access App" email — we can't prevent that,
  //    but our custom email below is the one with the correct team invite link.
  // Always call inviteUser to ensure the user has an app account.
  // SendEmail only works for users who have an account in the app.
  try {
    await base44.users.inviteUser(normalizedEmail, 'user');
    console.log('inviteUser succeeded for:', normalizedEmail);
  } catch (inviteErr) {
    console.log('inviteUser:', inviteErr?.message || 'already exists');
  }

  // Wait for account to propagate before sending custom email
  await new Promise(r => setTimeout(r, 2000));

  // 2) Send our custom team invitation email — this is the REAL email they should act on.
  //    The button links directly to the AcceptInvite page.
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedEmail,
      from_name: 'Investor Konnect',
      subject: `${ownerProfile.full_name || ownerProfile.email} invited you to join their team`,
      body: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0D0D0D; border-radius: 16px; overflow: hidden; border: 1px solid #1F1F1F;">
          <div style="padding: 40px 32px; text-align: center;">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2a5ae75f8_616CA829-4C69-40A9-8555-BE50375B7FC6.png" alt="Investor Konnect" width="48" height="48" style="margin-bottom: 16px;" />
            <h1 style="color: #E3C567; font-size: 26px; margin: 0 0 16px 0; font-family: Georgia, serif;">Team Invitation</h1>
            <p style="color: #FAFAFA; font-size: 16px; line-height: 1.5; margin: 0 0 8px 0;">
              <strong>${ownerProfile.full_name || ownerProfile.email}</strong> has invited you to join their team on Investor Konnect.
            </p>
            <div style="background: #141414; border: 1px solid #1F1F1F; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="color: #808080; font-size: 13px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px;">Your Role</p>
              <p style="color: #E3C567; font-size: 18px; font-weight: bold; margin: 0;">
                ${role === 'admin' ? '🔑 Admin — Full access to all deals' : '👁 Viewer — View all deals and activity'}
              </p>
            </div>
            <a href="${fullInviteUrl}" style="display: inline-block; padding: 16px 48px; background: #E3C567; color: #000; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; margin: 8px 0 24px 0;">
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
    console.log('Custom team invite email sent to:', normalizedEmail);
  } catch (emailErr) {
    console.error('Failed to send invite email:', emailErr?.message || emailErr);
  }

  return Response.json({ ok: true, message: `Invitation sent to ${normalizedEmail}` });
});