import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * CANONICAL PROFILE SYNC - Ensures exactly ONE profile per user
 * 
 * This is the SINGLE SOURCE OF TRUTH for profile creation/sync.
 * Called on every auth event (sign-in, sign-up, session check).
 * 
 * GUARANTEES:
 * 1. One-to-one mapping: Users.id ↔ Profile.user_id
 * 2. Role sync: Profile.role mirrors Users.role
 * 3. Email sync: Profile.email matches Users.email (case-insensitive)
 * 4. Idempotent: Safe to call multiple times
 * 5. Auto-cleanup: Detects and removes duplicate profiles
 * 
 * @param {Object} base44 - Base44 SDK instance with service role access
 * @param {Object} user - Authenticated user from base44.auth.me()
 * @returns {Object} The canonical Profile record for this user
 */
export async function ensureProfile(base44, user) {
  if (!user || !user.id || !user.email) {
    throw new Error('Invalid user object - missing id or email');
  }

  const userId = user.id;
  const email = user.email.trim();
  const userRole = user.role || 'member'; // Users table role is authoritative

  console.log('🔄 [ensureProfile] Syncing profile for user:', { userId, email, role: userRole });

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      // STEP 1: Query by user_id (the primary key relationship)
      let profiles = await base44.asServiceRole.entities.Profile.filter({ 
        user_id: userId 
      });

      // STEP 2: Handle the cases
      if (profiles.length === 1) {
        // PERFECT: Exactly one profile found
        const profile = profiles[0];
        console.log('✅ [ensureProfile] Found canonical profile:', profile.id);
        
        // Sync email and role from Users table (source of truth)
        let needsUpdate = false;
        const updates = {};
        
        if (profile.email.toLowerCase() !== email.toLowerCase()) {
          console.log('📧 [ensureProfile] Email mismatch - syncing from Users table');
          updates.email = email;
          needsUpdate = true;
        }
        
        if (profile.role !== userRole) {
          console.log('👤 [ensureProfile] Role mismatch - syncing from Users table');
          updates.role = userRole;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await base44.asServiceRole.entities.Profile.update(profile.id, updates);
          console.log('✅ [ensureProfile] Profile synced with Users table');
          // Update local copy
          Object.assign(profile, updates);
        }
        
        return profile;
      }

      if (profiles.length > 1) {
        // CRITICAL: Multiple profiles found for same user_id (should never happen with unique constraint)
        console.error('🚨 [ensureProfile] DUPLICATE PROFILES FOR USER_ID');
        console.error('   User ID:', userId);
        console.error('   Count:', profiles.length);
        console.error('   Profile IDs:', profiles.map(p => p.id).join(', '));
        
        // Auto-heal: Keep the most complete/recent profile
        profiles.sort((a, b) => {
          // Prefer profile with onboarding completed
          if (a.onboarding_completed_at && !b.onboarding_completed_at) return -1;
          if (!a.onboarding_completed_at && b.onboarding_completed_at) return 1;
          // Prefer profile with NDA accepted
          if (a.nda_accepted && !b.nda_accepted) return -1;
          if (!a.nda_accepted && b.nda_accepted) return 1;
          // Prefer most recently updated
          const aTime = new Date(a.updated_date || a.created_date).getTime();
          const bTime = new Date(b.updated_date || b.created_date).getTime();
          return bTime - aTime; // Most recent first
        });
        
        const keepProfile = profiles[0];
        console.log('   ✅ Keeping profile:', keepProfile.id);
        
        // Log to audit before deleting
        for (let i = 1; i < profiles.length; i++) {
          const dupProfile = profiles[i];
          console.log('   ❌ Deleting duplicate:', dupProfile.id);
          
          try {
            // Log to audit table
            await base44.asServiceRole.entities.AuditLog.create({
              actor_id: 'system',
              actor_name: 'ensureProfile Auto-Cleanup',
              entity_type: 'Profile',
              entity_id: dupProfile.id,
              action: 'delete_duplicate',
              details: `Duplicate profile deleted for user_id=${userId}. Kept profile ${keepProfile.id}`,
              timestamp: new Date().toISOString()
            });
          } catch (auditErr) {
            console.warn('   ⚠️ Failed to log audit:', auditErr.message);
          }
          
          try {
            await base44.asServiceRole.entities.Profile.delete(dupProfile.id);
            console.log('   ✅ Deleted duplicate:', dupProfile.id);
          } catch (delErr) {
            console.error('   ❌ Failed to delete duplicate:', dupProfile.id, delErr.message);
          }
        }
        
        // Sync the kept profile with Users table
        await base44.asServiceRole.entities.Profile.update(keepProfile.id, {
          email: email,
          role: userRole
        });
        
        return keepProfile;
      }

      // STEP 3: No profile found - need to create
      if (profiles.length === 0) {
        console.log('🆕 [ensureProfile] No profile found, creating canonical profile...');
        
        // Check if there's an orphaned profile by email (old data before unique constraint)
        const emailProfiles = await base44.asServiceRole.entities.Profile.filter({ 
          email: email 
        });
        
        if (emailProfiles.length > 0) {
          console.log('⚠️ [ensureProfile] Found orphaned profile by email, adopting it');
          const orphan = emailProfiles[0];
          
          // Update the orphaned profile to link to this user_id
          await base44.asServiceRole.entities.Profile.update(orphan.id, {
            user_id: userId,
            email: email,
            role: userRole
          });
          
          console.log('✅ [ensureProfile] Adopted orphaned profile:', orphan.id);
          orphan.user_id = userId;
          orphan.email = email;
          orphan.role = userRole;
          
          return orphan;
        }
        
        // No existing profile at all - create new one
        try {
          const newProfile = await base44.asServiceRole.entities.Profile.create({
            user_id: userId,
            email: email,
            role: userRole,
            onboarding_completed_at: null,
            nda_accepted: false,
            nda_version: "v1.0"
          });
          
          console.log('✅ [ensureProfile] Created canonical profile:', newProfile.id);
          
          // Log creation to audit
          try {
            await base44.asServiceRole.entities.AuditLog.create({
              actor_id: userId,
              actor_name: email,
              entity_type: 'Profile',
              entity_id: newProfile.id,
              action: 'create',
              details: 'Profile auto-created via ensureProfile on auth',
              timestamp: new Date().toISOString()
            });
          } catch (auditErr) {
            console.warn('⚠️ Failed to log audit:', auditErr.message);
          }
          
          return newProfile;
          
        } catch (createErr) {
          const errMsg = (createErr.message || '').toLowerCase();
          const isDuplicateError = 
            errMsg.includes('duplicate') ||
            errMsg.includes('unique') ||
            errMsg.includes('already exists') ||
            errMsg.includes('constraint');
          
          if (isDuplicateError && attempts < maxAttempts) {
            // Race condition - another request created the profile
            console.log('⚠️ [ensureProfile] Race condition detected, retrying...');
            await new Promise(resolve => setTimeout(resolve, 300 * attempts));
            continue; // Retry the loop
          } else {
            // Different error or max retries reached
            console.error('❌ [ensureProfile] Failed to create profile:', createErr.message);
            throw createErr;
          }
        }
      }

    } catch (error) {
      console.error('❌ [ensureProfile] Error on attempt', attempts, ':', error.message);
      
      if (attempts >= maxAttempts) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 300 * attempts));
    }
  }

  throw new Error('Failed to ensure profile after max attempts');
}

/**
 * Sync all existing profiles with Users table
 * This is a maintenance function that can be called by admins
 */
export async function syncAllProfiles(base44) {
  console.log('🔄 [syncAllProfiles] Starting bulk sync...');
  
  try {
    // Get all users
    const users = await base44.asServiceRole.entities.User.list();
    console.log(`📊 Found ${users.length} users to sync`);
    
    let synced = 0;
    let created = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        const profile = await ensureProfile(base44, user);
        if (profile) {
          synced++;
        }
      } catch (err) {
        console.error(`❌ Failed to sync user ${user.id}:`, err.message);
        errors++;
      }
    }
    
    console.log('✅ [syncAllProfiles] Complete:', { synced, created, errors });
    
    return { synced, created, errors };
  } catch (error) {
    console.error('❌ [syncAllProfiles] Failed:', error);
    throw error;
  }
}

// Deno serve handler (library file, not a request handler)
Deno.serve(() => {
  return Response.json({ 
    error: 'This is a library function. Use /functions/profileHealthCheck to test.' 
  }, { status: 400 });
});