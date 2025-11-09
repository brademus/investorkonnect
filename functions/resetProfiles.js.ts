import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * RESET ALL NON-ADMIN PROFILES
 * 
 * ADMIN-ONLY: Deletes all investor/agent profiles for non-admin users
 * Use this to start fresh with test data
 * 
 * CRITICAL: This does NOT delete admin users or their profiles
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Reset Non-Admin Profiles ===');
    
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('User:', user.email);
    
    // Check if user is admin
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    
    if (profiles.length === 0) {
      return Response.json({ 
        ok: false, 
        message: 'Profile not found' 
      }, { status: 404 });
    }
    
    const profile = profiles[0];
    
    if (profile.role !== 'admin') {
      console.log('❌ User is not admin, role:', profile.role);
      return Response.json({ 
        ok: false, 
        message: 'Admin access required' 
      }, { status: 403 });
    }
    
    console.log('✅ User is admin, proceeding with reset');
    
    // Get all profiles
    const allProfiles = await base44.asServiceRole.entities.Profile.filter({});
    
    console.log('Found', allProfiles.length, 'total profiles');
    
    // Filter non-admin profiles
    const nonAdminProfiles = allProfiles.filter(p => p.role !== 'admin');
    
    console.log('Found', nonAdminProfiles.length, 'non-admin profiles to delete');
    
    // Delete each non-admin profile
    let deletedCount = 0;
    let errors = [];
    
    for (const profileToDelete of nonAdminProfiles) {
      try {
        console.log('Deleting profile:', profileToDelete.email, 'role:', profileToDelete.user_role);
        await base44.asServiceRole.entities.Profile.delete(profileToDelete.id);
        deletedCount++;
      } catch (err) {
        console.error('Failed to delete profile:', profileToDelete.email, err);
        errors.push({
          email: profileToDelete.email,
          error: err.message,
        });
      }
    }
    
    console.log('✅ Reset complete');
    console.log('Deleted:', deletedCount, 'profiles');
    console.log('Errors:', errors.length);
    
    return Response.json({
      ok: true,
      message: 'Non-admin profiles reset successfully',
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error('❌ Reset error:', error);
    return Response.json({ 
      ok: false, 
      message: error.message 
    }, { status: 500 });
  }
});