import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Self-deduplication: Remove duplicate profiles for the current user
 * Keeps the most recently updated profile
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailLower = user.email.toLowerCase().trim();
    
    // Find all profiles for this email
    const profiles = await base44.asServiceRole.entities.Profile.filter({ email: emailLower });
    
    if (!profiles || profiles.length <= 1) {
      return Response.json({ 
        message: 'No duplicates found',
        deletedCount: 0 
      });
    }

    console.log(`[dedupeProfileByEmail] Found ${profiles.length} profiles for ${emailLower}`);

    // Sort by updated_date DESC, keep the first (most recent)
    const sorted = profiles.sort((a, b) => 
      new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0)
    );
    
    const keepProfile = sorted[0];
    const duplicates = sorted.slice(1);

    console.log(`[dedupeProfileByEmail] Keeping profile ${keepProfile.id}, deleting ${duplicates.length} duplicates`);

    // Ensure the kept profile has user_id set
    if (!keepProfile.user_id || keepProfile.user_id !== user.id) {
      await base44.asServiceRole.entities.Profile.update(keepProfile.id, { user_id: user.id });
    }

    // Delete duplicates
    for (const dup of duplicates) {
      try {
        await base44.asServiceRole.entities.Profile.delete(dup.id);
        console.log(`[dedupeProfileByEmail] Deleted duplicate profile ${dup.id}`);
      } catch (e) {
        console.error(`[dedupeProfileByEmail] Failed to delete ${dup.id}:`, e);
      }
    }

    return Response.json({ 
      message: `Removed ${duplicates.length} duplicate profile(s)`,
      deletedCount: duplicates.length,
      keptProfileId: keepProfile.id
    });

  } catch (error) {
    console.error('[dedupeProfileByEmail] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to deduplicate profiles' 
    }, { status: 500 });
  }
});