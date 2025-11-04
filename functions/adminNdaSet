import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Admin function to toggle NDA acceptance status for any user
 * POST /functions/adminNdaSet
 * Body: { user_id: string, accepted: boolean }
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
    
    if (currentProfiles.length === 0) {
      return Response.json({
        ok: false,
        error: "profile_not_found"
      }, { status: 404 });
    }

    const currentProfile = currentProfiles[0];
    
    // Check if user is admin (check both profile.role and user.role)
    const isAdmin = currentProfile.role === 'admin' || currentUser.role === 'admin';
    
    if (!isAdmin) {
      console.log('[adminNdaSet] Access denied for user:', {
        email: currentUser.email,
        profileRole: currentProfile.role,
        userRole: currentUser.role
      });
      
      return Response.json({
        ok: false,
        error: "admin_only"
      }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { user_id, accepted } = body;

    if (!user_id || typeof accepted !== 'boolean') {
      return Response.json({
        ok: false,
        error: "invalid_parameters"
      }, { status: 400 });
    }

    // Find target profile by user_id
    const targetProfiles = await base44.asServiceRole.entities.Profile.filter({
      user_id: user_id
    });

    if (targetProfiles.length === 0) {
      return Response.json({
        ok: false,
        error: "target_profile_not_found"
      }, { status: 404 });
    }

    const targetProfile = targetProfiles[0];

    // Update NDA status
    const updateData = {
      nda_accepted: accepted
    };

    if (accepted) {
      // Setting to accepted - add timestamps if not present
      if (!targetProfile.nda_accepted_at) {
        updateData.nda_accepted_at = new Date().toISOString();
      }
      if (!targetProfile.nda_version) {
        updateData.nda_version = "v1.0";
      }
    } else {
      // Setting to not accepted - clear timestamps
      updateData.nda_accepted_at = null;
      updateData.nda_version = "v1.0";
    }

    // Perform update
    await base44.asServiceRole.entities.Profile.update(targetProfile.id, updateData);

    console.log('[adminNdaSet] NDA status updated by admin:', {
      admin: currentUser.email,
      target_user_id: user_id,
      target_email: targetProfile.email,
      accepted: accepted
    });

    return Response.json({
      ok: true,
      profile: {
        id: targetProfile.id,
        user_id: targetProfile.user_id,
        email: targetProfile.email,
        nda_accepted: accepted,
        nda_accepted_at: updateData.nda_accepted_at,
        nda_version: updateData.nda_version
      }
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('[adminNdaSet] Error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});