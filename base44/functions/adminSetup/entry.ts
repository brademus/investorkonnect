import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * One-time admin setup function
 * Run this to:
 * 1. Delete ALL profiles
 * 2. Recreate ONE profile per user with correct role
 * 3. Set admin role for specified email
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    console.log('🔧 [AdminSetup] Starting...');
    
    const results = {
      step1_deleted: 0,
      step2_created: 0,
      step3_admin_set: false,
      errors: []
    };

    // STEP 1: Delete ALL existing profiles (clean slate)
    console.log('📋 Step 1: Deleting all existing profiles...');
    try {
      const allProfiles = await base44.asServiceRole.entities.Profile.list();
      console.log(`   Found ${allProfiles.length} profiles to delete`);
      
      for (const profile of allProfiles) {
        try {
          await base44.asServiceRole.entities.Profile.delete(profile.id);
          results.step1_deleted++;
        } catch (e) {
          console.error(`   Failed to delete ${profile.id}:`, e.message);
        }
      }
      
      console.log(`   ✅ Deleted ${results.step1_deleted} profiles`);
    } catch (e) {
      console.error('   ❌ Step 1 failed:', e);
      results.errors.push(`Step 1: ${e.message}`);
    }

    // STEP 2: Create ONE profile per user from Users table
    console.log('📋 Step 2: Creating profiles from Users table...');
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      console.log(`   Found ${allUsers.length} users`);
      
      for (const user of allUsers) {
        try {
          // Create profile with correct role from Users table
          const newProfile = await base44.asServiceRole.entities.Profile.create({
            user_id: user.id,
            email: user.email.toLowerCase().trim(),
            role: user.role || 'member', // Sync role from Users table
            full_name: user.full_name || user.email.split('@')[0],
            onboarding_completed_at: null,
            nda_accepted: false,
            nda_version: "v1.0"
          });
          
          console.log(`   ✅ Created profile for ${user.email} with role: ${user.role || 'member'}`);
          results.step2_created++;
        } catch (e) {
          console.error(`   ❌ Failed to create profile for ${user.email}:`, e.message);
          results.errors.push(`User ${user.email}: ${e.message}`);
        }
      }
      
      console.log(`   ✅ Created ${results.step2_created} profiles`);
    } catch (e) {
      console.error('   ❌ Step 2 failed:', e);
      results.errors.push(`Step 2: ${e.message}`);
    }

    // STEP 3: Parse request to see if we should set admin
    let adminEmail = null;
    try {
      const body = await req.json();
      adminEmail = body.adminEmail;
    } catch (e) {
      // No body or invalid JSON - that's okay
    }

    if (adminEmail) {
      console.log(`📋 Step 3: Setting admin role for ${adminEmail}...`);
      try {
        // Find user by email
        const users = await base44.asServiceRole.entities.User.list();
        const adminUser = users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
        
        if (!adminUser) {
          console.error(`   ❌ User not found: ${adminEmail}`);
          results.errors.push(`User not found: ${adminEmail}`);
        } else {
          // Update BOTH Users table and Profile table
          // First update Users table (source of truth)
          await base44.asServiceRole.entities.User.update(adminUser.id, {
            role: 'admin'
          });
          
          // Then update Profile table
          const profiles = await base44.asServiceRole.entities.Profile.filter({ 
            user_id: adminUser.id 
          });
          
          if (profiles.length > 0) {
            await base44.asServiceRole.entities.Profile.update(profiles[0].id, {
              role: 'admin'
            });
            console.log(`   ✅ Set admin role for ${adminEmail}`);
            results.step3_admin_set = true;
          } else {
            console.error(`   ❌ No profile found for ${adminEmail}`);
            results.errors.push(`No profile found for ${adminEmail}`);
          }
        }
      } catch (e) {
        console.error('   ❌ Step 3 failed:', e);
        results.errors.push(`Step 3: ${e.message}`);
      }
    }

    console.log('');
    console.log('🔧 [AdminSetup] Complete');
    console.log(`   Profiles deleted: ${results.step1_deleted}`);
    console.log(`   Profiles created: ${results.step2_created}`);
    console.log(`   Admin set: ${results.step3_admin_set}`);
    console.log(`   Errors: ${results.errors.length}`);
    console.log('');

    return Response.json({
      success: true,
      results: results
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ [AdminSetup] Fatal error:', error);
    return Response.json({ 
      success: false,
      error: error.message
    }, { status: 500 });
  }
});