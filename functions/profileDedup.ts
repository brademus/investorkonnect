import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { ensureProfile } from './ensureProfile.js';

/**
 * Profile Deduplication Function
 * 
 * One-time migration to clean up duplicate profiles.
 * Can be run multiple times safely (idempotent).
 * 
 * Steps:
 * 1. Find all duplicate profiles (multiple profiles per user_id)
 * 2. Keep the most complete/recent profile
 * 3. Delete duplicates
 * 4. Log all deletions to AuditLog
 * 5. Sync all profiles with Users table
 * 
 * Admin-only function.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0 || profiles[0].role !== 'admin') {
      return Response.json({ error: 'Admin only - this function requires admin privileges' }, { status: 403 });
    }

    console.log('🧹 [Dedup] Starting profile deduplication...');
    console.log(`   Initiated by: ${user.email}`);

    const results = {
      timestamp: new Date().toISOString(),
      initiated_by: user.email,
      phase1_dedup: {},
      phase2_orphans: {},
      phase3_sync: {},
      summary: {
        duplicates_removed: 0,
        orphans_fixed: 0,
        profiles_synced: 0,
        errors: 0
      }
    };

    // PHASE 1: Find and remove duplicates by user_id
    console.log('📋 [Dedup] Phase 1: Finding duplicate profiles...');
    try {
      const allProfiles = await base44.asServiceRole.entities.Profile.list();
      console.log(`   Found ${allProfiles.length} total profiles`);
      
      // Group by user_id
      const byUserId = {};
      allProfiles.forEach(p => {
        if (p.user_id) {
          if (!byUserId[p.user_id]) {
            byUserId[p.user_id] = [];
          }
          byUserId[p.user_id].push(p);
        }
      });
      
      // Find duplicates
      const duplicateGroups = Object.entries(byUserId)
        .filter(([_, profs]) => profs.length > 1)
        .map(([user_id, profs]) => ({ user_id, profiles: profs }));
      
      console.log(`   Found ${duplicateGroups.length} users with duplicate profiles`);
      
      const deleted = [];
      
      for (const group of duplicateGroups) {
        console.log(`   Processing user ${group.user_id}: ${group.profiles.length} profiles`);
        
        // Sort to keep the best one
        group.profiles.sort((a, b) => {
          // Prefer profile with onboarding completed
          if (a.onboarding_completed_at && !b.onboarding_completed_at) return -1;
          if (!a.onboarding_completed_at && b.onboarding_completed_at) return 1;
          // Prefer profile with NDA accepted
          if (a.nda_accepted && !b.nda_accepted) return -1;
          if (!a.nda_accepted && b.nda_accepted) return 1;
          // Prefer most recently updated
          const aTime = new Date(a.updated_date || a.created_date).getTime();
          const bTime = new Date(b.updated_date || b.created_date).getTime();
          return bTime - aTime;
        });
        
        const keep = group.profiles[0];
        console.log(`     ✅ Keeping: ${keep.id}`);
        
        // Delete the rest
        for (let i = 1; i < group.profiles.length; i++) {
          const dup = group.profiles[i];
          console.log(`     ❌ Deleting: ${dup.id}`);
          
          try {
            // Log to audit
            await base44.asServiceRole.entities.AuditLog.create({
              actor_id: user.id,
              actor_name: user.email,
              entity_type: 'Profile',
              entity_id: dup.id,
              action: 'delete_duplicate',
              details: `Duplicate profile deleted for user_id=${group.user_id}. Kept profile ${keep.id}`,
              timestamp: new Date().toISOString()
            });
            
            // Delete
            await base44.asServiceRole.entities.Profile.delete(dup.id);
            
            deleted.push({
              deleted_id: dup.id,
              kept_id: keep.id,
              user_id: group.user_id,
              reason: 'duplicate_user_id'
            });
            
            results.summary.duplicates_removed++;
          } catch (err) {
            console.error(`     ❌ Failed to delete ${dup.id}:`, err.message);
            results.summary.errors++;
          }
        }
      }
      
      results.phase1_dedup = {
        total_profiles: allProfiles.length,
        duplicate_groups: duplicateGroups.length,
        profiles_deleted: deleted.length,
        deleted_profiles: deleted
      };
      
      console.log(`   ✅ Phase 1 complete: Deleted ${deleted.length} duplicate profiles`);
    } catch (err) {
      console.error('   ❌ Phase 1 failed:', err.message);
      results.phase1_dedup = { error: err.message };
      results.summary.errors++;
    }

    // PHASE 2: Fix orphaned profiles (profiles without user_id or with invalid user_id)
    console.log('📋 [Dedup] Phase 2: Fixing orphaned profiles...');
    try {
      const allProfiles = await base44.asServiceRole.entities.Profile.list();
      const allUsers = await base44.asServiceRole.entities.User.list();
      const validUserIds = new Set(allUsers.map(u => u.id));
      
      const orphans = allProfiles.filter(p => !p.user_id || !validUserIds.has(p.user_id));
      console.log(`   Found ${orphans.length} orphaned profiles`);
      
      const fixed = [];
      
      for (const orphan of orphans) {
        if (orphan.email) {
          // Try to find matching user by email
          const matchingUser = allUsers.find(u => u.email.toLowerCase() === orphan.email.toLowerCase());
          
          if (matchingUser) {
            console.log(`     🔗 Linking orphan ${orphan.id} to user ${matchingUser.id}`);
            
            try {
              await base44.asServiceRole.entities.Profile.update(orphan.id, {
                user_id: matchingUser.id
              });
              
              fixed.push({
                profile_id: orphan.id,
                matched_user_id: matchingUser.id,
                email: orphan.email
              });
              
              results.summary.orphans_fixed++;
            } catch (err) {
              console.error(`     ❌ Failed to fix ${orphan.id}:`, err.message);
              results.summary.errors++;
            }
          } else {
            console.log(`     ⚠️ No matching user for orphan ${orphan.id} (${orphan.email})`);
          }
        }
      }
      
      results.phase2_orphans = {
        orphans_found: orphans.length,
        orphans_fixed: fixed.length,
        fixed_profiles: fixed
      };
      
      console.log(`   ✅ Phase 2 complete: Fixed ${fixed.length} orphaned profiles`);
    } catch (err) {
      console.error('   ❌ Phase 2 failed:', err.message);
      results.phase2_orphans = { error: err.message };
      results.summary.errors++;
    }

    // PHASE 3: Sync all profiles with Users table
    console.log('📋 [Dedup] Phase 3: Syncing profiles with Users table...');
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      console.log(`   Found ${allUsers.length} users to sync`);
      
      const synced = [];
      
      for (const u of allUsers) {
        try {
          const profile = await ensureProfile(base44, u);
          synced.push({
            user_id: u.id,
            profile_id: profile.id,
            email: u.email,
            role: u.role
          });
          results.summary.profiles_synced++;
        } catch (err) {
          console.error(`   ❌ Failed to sync user ${u.id}:`, err.message);
          results.summary.errors++;
        }
      }
      
      results.phase3_sync = {
        users_processed: allUsers.length,
        profiles_synced: synced.length,
        synced_profiles: synced.slice(0, 10) // Sample of first 10
      };
      
      console.log(`   ✅ Phase 3 complete: Synced ${synced.length} profiles`);
    } catch (err) {
      console.error('   ❌ Phase 3 failed:', err.message);
      results.phase3_sync = { error: err.message };
      results.summary.errors++;
    }

    // Final summary
    console.log('');
    console.log('🧹 [Dedup] Deduplication complete');
    console.log(`   Duplicates removed: ${results.summary.duplicates_removed}`);
    console.log(`   Orphans fixed: ${results.summary.orphans_fixed}`);
    console.log(`   Profiles synced: ${results.summary.profiles_synced}`);
    console.log(`   Errors: ${results.summary.errors}`);
    console.log('');

    return Response.json(results, {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ [Dedup] Failed:', error);
    return Response.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});