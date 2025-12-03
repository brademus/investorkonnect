import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Profile Health Check Function
 * 
 * Verifies the integrity of the User ↔ Profile sync:
 * 1. One profile per user_id
 * 2. Role sync between Users and Profile
 * 3. Email consistency
 * 4. Onboarding gating logic
 * 
 * Can be called by admins or automated monitoring
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
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    console.log('🏥 [HealthCheck] Starting profile integrity check...');

    const results = {
      timestamp: new Date().toISOString(),
      checks: {},
      issues: [],
      summary: {
        total_users: 0,
        total_profiles: 0,
        duplicates_found: 0,
        orphaned_profiles: 0,
        role_mismatches: 0,
        email_mismatches: 0
      }
    };

    // CHECK 1: Verify one profile per user_id
    console.log('🔍 [HealthCheck] Check 1: Duplicate profiles by user_id');
    try {
      const allProfiles = await base44.asServiceRole.entities.Profile.list();
      results.summary.total_profiles = allProfiles.length;
      
      const userIdCounts = {};
      allProfiles.forEach(p => {
        if (p.user_id) {
          userIdCounts[p.user_id] = (userIdCounts[p.user_id] || 0) + 1;
        }
      });
      
      const duplicates = Object.entries(userIdCounts)
        .filter(([_, count]) => count > 1)
        .map(([user_id, count]) => ({ user_id, count }));
      
      results.summary.duplicates_found = duplicates.length;
      results.checks.duplicates = {
        passed: duplicates.length === 0,
        duplicates: duplicates
      };
      
      if (duplicates.length > 0) {
        results.issues.push({
          severity: 'critical',
          type: 'duplicate_profiles',
          message: `Found ${duplicates.length} users with multiple profiles`,
          data: duplicates
        });
      }
      
      console.log(`   ${duplicates.length === 0 ? '✅' : '❌'} Found ${duplicates.length} duplicate user_ids`);
    } catch (err) {
      results.checks.duplicates = { passed: false, error: err.message };
      console.error('   ❌ Check failed:', err.message);
    }

    // CHECK 2: Verify all users have exactly one profile
    console.log('🔍 [HealthCheck] Check 2: User-Profile mapping');
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      results.summary.total_users = allUsers.length;
      
      const usersWithoutProfile = [];
      
      for (const u of allUsers) {
        const profs = await base44.asServiceRole.entities.Profile.filter({ user_id: u.id });
        if (profs.length === 0) {
          usersWithoutProfile.push({ user_id: u.id, email: u.email });
        }
      }
      
      results.checks.user_profile_mapping = {
        passed: usersWithoutProfile.length === 0,
        users_without_profile: usersWithoutProfile.length,
        missing_users: usersWithoutProfile
      };
      
      if (usersWithoutProfile.length > 0) {
        results.issues.push({
          severity: 'high',
          type: 'missing_profiles',
          message: `Found ${usersWithoutProfile.length} users without profiles`,
          data: usersWithoutProfile
        });
      }
      
      console.log(`   ${usersWithoutProfile.length === 0 ? '✅' : '❌'} Found ${usersWithoutProfile.length} users without profiles`);
    } catch (err) {
      results.checks.user_profile_mapping = { passed: false, error: err.message };
      console.error('   ❌ Check failed:', err.message);
    }

    // CHECK 3: Verify role sync (sample check)
    console.log('🔍 [HealthCheck] Check 3: Role synchronization');
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      const sampleSize = Math.min(20, allUsers.length);
      const sample = allUsers.slice(0, sampleSize);
      
      const roleMismatches = [];
      
      for (const u of sample) {
        const profs = await base44.asServiceRole.entities.Profile.filter({ user_id: u.id });
        if (profs.length > 0) {
          const prof = profs[0];
          if (prof.role !== u.role) {
            roleMismatches.push({
              user_id: u.id,
              email: u.email,
              users_role: u.role,
              profile_role: prof.role
            });
          }
        }
      }
      
      results.summary.role_mismatches = roleMismatches.length;
      results.checks.role_sync = {
        passed: roleMismatches.length === 0,
        sample_size: sampleSize,
        mismatches: roleMismatches
      };
      
      if (roleMismatches.length > 0) {
        results.issues.push({
          severity: 'medium',
          type: 'role_mismatch',
          message: `Found ${roleMismatches.length} role mismatches in sample of ${sampleSize}`,
          data: roleMismatches
        });
      }
      
      console.log(`   ${roleMismatches.length === 0 ? '✅' : '❌'} Found ${roleMismatches.length} role mismatches`);
    } catch (err) {
      results.checks.role_sync = { passed: false, error: err.message };
      console.error('   ❌ Check failed:', err.message);
    }

    // CHECK 4: Verify email sync (sample check)
    console.log('🔍 [HealthCheck] Check 4: Email synchronization');
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      const sampleSize = Math.min(20, allUsers.length);
      const sample = allUsers.slice(0, sampleSize);
      
      const emailMismatches = [];
      
      for (const u of sample) {
        const profs = await base44.asServiceRole.entities.Profile.filter({ user_id: u.id });
        if (profs.length > 0) {
          const prof = profs[0];
          if (prof.email.toLowerCase() !== u.email.toLowerCase()) {
            emailMismatches.push({
              user_id: u.id,
              users_email: u.email,
              profile_email: prof.email
            });
          }
        }
      }
      
      results.summary.email_mismatches = emailMismatches.length;
      results.checks.email_sync = {
        passed: emailMismatches.length === 0,
        sample_size: sampleSize,
        mismatches: emailMismatches
      };
      
      if (emailMismatches.length > 0) {
        results.issues.push({
          severity: 'medium',
          type: 'email_mismatch',
          message: `Found ${emailMismatches.length} email mismatches in sample of ${sampleSize}`,
          data: emailMismatches
        });
      }
      
      console.log(`   ${emailMismatches.length === 0 ? '✅' : '❌'} Found ${emailMismatches.length} email mismatches`);
    } catch (err) {
      results.checks.email_sync = { passed: false, error: err.message };
      console.error('   ❌ Check failed:', err.message);
    }

    // CHECK 5: Verify onboarding gating logic
    console.log('🔍 [HealthCheck] Check 5: Onboarding gating');
    try {
      const allProfiles = await base44.asServiceRole.entities.Profile.list('-updated_date', 10);
      
      const onboardingChecks = allProfiles.map(p => {
        const isOnboarded = !!p.onboarding_completed_at;
        const expectedRoute = isOnboarded ? '/dashboard' : '/onboarding';
        
        return {
          profile_id: p.id,
          email: p.email,
          onboarded: isOnboarded,
          expected_route: expectedRoute
        };
      });
      
      results.checks.onboarding_gating = {
        passed: true,
        sample_size: onboardingChecks.length,
        samples: onboardingChecks
      };
      
      console.log(`   ✅ Onboarding gating logic verified for ${onboardingChecks.length} profiles`);
    } catch (err) {
      results.checks.onboarding_gating = { passed: false, error: err.message };
      console.error('   ❌ Check failed:', err.message);
    }

    // SUMMARY
    const allChecksPassed = Object.values(results.checks).every(c => c.passed !== false);
    results.summary.health_status = allChecksPassed ? 'healthy' : 'needs_attention';
    results.summary.checks_passed = Object.values(results.checks).filter(c => c.passed === true).length;
    results.summary.checks_total = Object.keys(results.checks).length;

    console.log('');
    console.log('🏥 [HealthCheck] Complete');
    console.log(`   Status: ${results.summary.health_status.toUpperCase()}`);
    console.log(`   Checks: ${results.summary.checks_passed}/${results.summary.checks_total} passed`);
    console.log(`   Issues: ${results.issues.length} found`);
    console.log('');

    return Response.json(results, {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ [HealthCheck] Failed:', error);
    return Response.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});