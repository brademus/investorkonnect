import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Admin-only endpoint to toggle NDA acceptance status for any user
 * POST /functions/adminNdaToggle
 * Body: { user_id: string, accepted: boolean }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin authentication
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get admin profile
    const adminProfiles = await base44.asServiceRole.entities.Profile.filter({
      user_id: currentUser.id
    });

    if (adminProfiles.length === 0 || adminProfiles[0].role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request
    const body = await req.json();
    const { user_id, accepted } = body;

    if (!user_id || typeof accepted !== 'boolean') {
      return Response.json({ 
        error: 'Missing required fields: user_id, accepted' 
      }, { status: 400 });
    }

    // Find target profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({
      user_id: user_id
    });

    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];

    // Update NDA fields
    const updates = {
      nda_accepted: accepted,
      nda_accepted_at: accepted ? new Date().toISOString() : null,
      nda_version: accepted ? 'v1.0' : null,
      nda_ip: accepted ? 'admin-override' : null
    };

    await base44.asServiceRole.entities.Profile.update(profile.id, updates);

    // Log action
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: adminProfiles[0].id,
      actor_name: adminProfiles[0].full_name || currentUser.email,
      entity_type: 'Profile',
      entity_id: profile.id,
      action: accepted ? 'nda_enabled' : 'nda_disabled',
      details: `Admin ${accepted ? 'enabled' : 'disabled'} NDA for ${profile.email}`,
      timestamp: new Date().toISOString()
    });

    return Response.json({
      success: true,
      profile: {
        id: profile.id,
        user_id: profile.user_id,
        email: profile.email,
        nda_accepted: updates.nda_accepted,
        nda_accepted_at: updates.nda_accepted_at
      }
    });

  } catch (error) {
    console.error('[adminNdaToggle] Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});