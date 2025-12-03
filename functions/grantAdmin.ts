import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Grant admin role to a user by email
 * Does NOT delete or reset any data - just updates the role
 * 
 * POST /functions/grantAdmin
 * Body: { email: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check if current user is admin
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({
        ok: false,
        error: "not_authenticated"
      }, { status: 401 });
    }

    // Get current user's profile to check admin role
    const currentProfiles = await base44.asServiceRole.entities.Profile.filter({
      user_id: currentUser.id
    });
    
    const currentProfile = currentProfiles[0];
    
    // Check if user is admin (check both profile.role and user.role)
    const isAdmin = currentProfile?.role === 'admin' || currentUser.role === 'admin';
    
    if (!isAdmin) {
      console.log('[grantAdmin] Access denied for user:', currentUser.email);
      return Response.json({
        ok: false,
        error: "admin_only"
      }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return Response.json({
        ok: false,
        error: "email_required"
      }, { status: 400 });
    }

    console.log('[grantAdmin] Granting admin to:', email);

    // Find user by email
    const users = await base44.asServiceRole.entities.User.list();
    const targetUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!targetUser) {
      return Response.json({
        ok: false,
        error: "user_not_found",
        message: `User with email ${email} not found`
      }, { status: 404 });
    }

    // Update User entity role
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      role: 'admin'
    });
    console.log('[grantAdmin] Updated User entity for:', email);

    // Find and update Profile entity
    const profiles = await base44.asServiceRole.entities.Profile.filter({
      user_id: targetUser.id
    });

    if (profiles.length > 0) {
      await base44.asServiceRole.entities.Profile.update(profiles[0].id, {
        role: 'admin'
      });
      console.log('[grantAdmin] Updated Profile entity for:', email);
    } else {
      // Create profile if it doesn't exist
      await base44.asServiceRole.entities.Profile.create({
        user_id: targetUser.id,
        email: targetUser.email.toLowerCase().trim(),
        full_name: targetUser.full_name || targetUser.email.split('@')[0],
        role: 'admin'
      });
      console.log('[grantAdmin] Created Profile entity for:', email);
    }

    return Response.json({
      ok: true,
      message: `${email} is now an admin`,
      user_id: targetUser.id
    });

  } catch (error) {
    console.error('[grantAdmin] Error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});