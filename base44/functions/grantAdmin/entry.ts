import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const callerProfiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    const callerProfile = callerProfiles[0];
    const callerIsAdmin = user.role === 'admin' || callerProfile?.role === 'admin';

    if (!callerIsAdmin) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { email, role } = body;

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const targetRole = role === 'member' ? 'member' : 'admin';
    const action = targetRole === 'admin' ? 'Granting admin to' : 'Removing admin from';

    console.log(`[grantAdmin] ${action}: ${email} (requested by: ${user.email})`);

    const allUsers = await base44.asServiceRole.entities.User.list();
    const targetUser = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!targetUser) {
      return Response.json({
        ok: false,
        error: `No account found for ${email}. The user must sign up first before being granted admin access.`
      }, { status: 404 });
    }

    await base44.asServiceRole.entities.User.update(targetUser.id, {
      role: targetRole
    });

    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: targetUser.id });

    if (profiles.length > 0) {
      await base44.asServiceRole.entities.Profile.update(profiles[0].id, {
        role: targetRole
      });
    } else {
      console.warn(`[grantAdmin] No profile found for ${email} — User role updated but profile not found`);
    }

    const successMsg = targetRole === 'admin'
      ? `${email} has been granted admin access. They will need to log out and back in for the change to take effect.`
      : `Admin access has been removed from ${email}. They will need to log out and back in for the change to take effect.`;

    console.log(`[grantAdmin] ${successMsg}`);

    return Response.json({ ok: true, message: successMsg });

  } catch (error) {
    console.error('[grantAdmin] Error:', error);
    return Response.json({ error: error.message || 'Failed to grant admin access' }, { status: 500 });
  }
});