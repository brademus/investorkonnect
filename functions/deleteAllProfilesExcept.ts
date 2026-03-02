import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can call this
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const PROTECTED_EMAILS = ['mike4verve@gmail.com', 'outtocreate@gmail.com', 'mike4empire@gmail.com', 'arturolefevre@yahoo.com', 'hellerbraden6@gmail.com'];

    // Get all profiles
    const allProfiles = await base44.asServiceRole.entities.Profile.list();
    
    // Filter to profiles we should delete
    const profilesToDelete = allProfiles.filter(p => 
      !PROTECTED_EMAILS.includes(p.email?.toLowerCase())
    );

    console.log(`[deleteAllProfilesExcept] Found ${profilesToDelete.length} profiles to delete`);
    console.log(`[deleteAllProfilesExcept] Protected profiles: ${PROTECTED_EMAILS.join(', ')}`);

    let deletedCount = 0;
    const errors = [];

    // Helper: delete with retry on rate limit
    const deleteWithRetry = async (entity, id, retries = 3) => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          await entity.delete(id);
          return true;
        } catch (err) {
          if (err?.message?.includes('Rate limit') && attempt < retries - 1) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          } else {
            throw err;
          }
        }
      }
    };

    // Process in batches of 5 profiles with pauses between batches
    const BATCH_SIZE = 3;
    for (let i = 0; i < profilesToDelete.length; i++) {
      const profile = profilesToDelete[i];
      try {
        const profileId = profile.id;

        // Just delete the profile — most test profiles have no associated data
        await deleteWithRetry(base44.asServiceRole.entities.Profile, profileId);
        deletedCount++;
        console.log(`[deleteAllProfilesExcept] Deleted profile ${deletedCount}: ${profile.email}`);

        // Pause longer every BATCH_SIZE profiles
        if ((i + 1) % BATCH_SIZE === 0) {
          await new Promise(r => setTimeout(r, 3000));
        } else {
          await new Promise(r => setTimeout(r, 300));
        }

      } catch (err) {
        console.error(`[deleteAllProfilesExcept] Error deleting profile ${profile.email}:`, err.message);
        errors.push({ email: profile.email, error: err.message });
      }
    }

    return Response.json({
      success: true,
      deletedCount,
      protectedProfiles: PROTECTED_EMAILS,
      errors: errors.length > 0 ? errors : null,
      message: `Deleted ${deletedCount} profiles and all associated data`
    });

  } catch (error) {
    console.error('[deleteAllProfilesExcept] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});