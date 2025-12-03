import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * RESET ALL NON-ADMIN PROFILES - NUCLEAR OPTION
 * 
 * ADMIN-ONLY: Completely wipes all non-admin user data from the system
 * 
 * This function:
 * 1. Identifies admin users (by role === 'admin' OR user_role === 'admin')
 * 2. Deletes ALL related data for non-admin users (matches, rooms, deals, etc.)
 * 3. Deletes ALL Profile records for non-admin users
 * 4. Leaves admin users and their data completely untouched
 * 
 * After this runs, non-admin users will be treated as brand new when they log in.
 */
Deno.serve(async (req) => {
  console.log('\n=== RESET NON-ADMIN PROFILES - START ===\n');
  
  try {
    const base44 = createClientFromRequest(req);
    
    // ========================================
    // STEP 1: VERIFY ADMIN ACCESS
    // ========================================
    console.log('STEP 1: Verifying admin access...');
    
    const currentUser = await base44.auth.me();
    
    if (!currentUser) {
      console.log('❌ ERROR: No authenticated user');
      return Response.json({ 
        ok: false,
        reason: 'AUTH_REQUIRED',
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('✓ Current user:', currentUser.email, '(id:', currentUser.id, ')');
    
    // Check if current user is admin
    const currentUserProfiles = await base44.asServiceRole.entities.Profile.filter({ 
      user_id: currentUser.id 
    });
    
    if (currentUserProfiles.length === 0) {
      console.log('❌ ERROR: No profile found for current user');
      return Response.json({ 
        ok: false,
        reason: 'PROFILE_NOT_FOUND',
        message: 'Your profile was not found' 
      }, { status: 404 });
    }
    
    const currentProfile = currentUserProfiles[0];
    console.log('✓ Current profile role:', currentProfile.role);
    console.log('✓ Current profile user_role:', currentProfile.user_role);
    console.log('✓ Current auth role:', currentUser.role);
    
    // Check admin status
    const isAdmin = 
      currentProfile.role === 'admin' || 
      currentProfile.user_role === 'admin' ||
      currentUser.role === 'admin';
    
    if (!isAdmin) {
      console.log('❌ ERROR: User is not admin');
      return Response.json({ 
        ok: false,
        reason: 'FORBIDDEN',
        message: 'Only admins can reset profiles' 
      }, { status: 403 });
    }
    
    console.log('✅ Admin access confirmed\n');
    
    // ========================================
    // STEP 2: IDENTIFY ADMIN USER IDs
    // ========================================
    console.log('STEP 2: Identifying admin users to protect...');
    
    // Get ALL profiles using service role
    const allProfiles = await base44.asServiceRole.entities.Profile.list('-created_date', 1000);
    console.log('✓ Loaded', allProfiles.length, 'total profiles from database');
    
    // Build set of admin user_ids to protect
    const adminUserIds = new Set();
    
    for (const profile of allProfiles) {
      // Check if profile is admin by ANY criteria
      const isAdminProfile = 
        profile.role === 'admin' || 
        profile.user_role === 'admin';
      
      if (isAdminProfile && profile.user_id) {
        adminUserIds.add(profile.user_id);
        console.log('  → PROTECTED ADMIN:', profile.email, '(user_id:', profile.user_id, ')');
      }
    }
    
    console.log('✅ Protected', adminUserIds.size, 'admin users\n');
    
    // ========================================
    // STEP 3: IDENTIFY NON-ADMIN PROFILES TO DELETE
    // ========================================
    console.log('STEP 3: Identifying non-admin profiles to delete...');
    
    const profilesToDelete = allProfiles.filter(p => {
      // Keep if admin
      if (adminUserIds.has(p.user_id)) {
        return false;
      }
      // Delete if not admin
      return true;
    });
    
    console.log('✓ Found', profilesToDelete.length, 'non-admin profiles to delete');
    
    // Build set of non-admin user_ids for related data cleanup
    const nonAdminUserIds = new Set();
    profilesToDelete.forEach(p => {
      if (p.user_id) {
        nonAdminUserIds.add(p.user_id);
      }
    });
    
    console.log('✓ Identified', nonAdminUserIds.size, 'unique non-admin user_ids\n');
    
    if (profilesToDelete.length === 0) {
      console.log('⚠️ No non-admin profiles to delete\n');
      return Response.json({
        ok: true,
        message: 'No non-admin profiles found',
        deletedProfiles: 0,
        deletedUsers: 0,
        details: {}
      });
    }
    
    // Log profiles that will be deleted
    console.log('Profiles to be deleted:');
    profilesToDelete.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.email} (id: ${p.id}, user_id: ${p.user_id})`);
    });
    console.log('');
    
    // ========================================
    // STEP 4: DELETE RELATED DATA FIRST
    // ========================================
    console.log('STEP 4: Deleting related data...');
    
    const stats = {
      matches: 0,
      introRequests: 0,
      roomMessages: 0,
      rooms: 0,
      deals: 0,
      reviews: 0,
      auditLogs: 0,
      profiles: 0,
    };
    
    // Convert to array for includes() check
    const nonAdminUserIdArray = Array.from(nonAdminUserIds);
    
    // Delete Matches
    console.log('  → Deleting Matches...');
    try {
      const matches = await base44.asServiceRole.entities.Match.list('-created_date', 1000);
      for (const match of matches) {
        if (nonAdminUserIdArray.includes(match.investorId) || nonAdminUserIdArray.includes(match.agentId)) {
          await base44.asServiceRole.entities.Match.delete(match.id);
          stats.matches++;
        }
      }
      console.log('    ✓ Deleted', stats.matches, 'matches');
    } catch (err) {
      console.log('    ⚠️ Error:', err.message);
    }
    
    // Delete IntroRequests
    console.log('  → Deleting IntroRequests...');
    try {
      const intros = await base44.asServiceRole.entities.IntroRequest.list('-created_date', 1000);
      for (const intro of intros) {
        if (nonAdminUserIdArray.includes(intro.investorId) || nonAdminUserIdArray.includes(intro.agentId)) {
          await base44.asServiceRole.entities.IntroRequest.delete(intro.id);
          stats.introRequests++;
        }
      }
      console.log('    ✓ Deleted', stats.introRequests, 'intro requests');
    } catch (err) {
      console.log('    ⚠️ Error:', err.message);
    }
    
    // Delete RoomMessages
    console.log('  → Deleting RoomMessages...');
    try {
      const messages = await base44.asServiceRole.entities.RoomMessage.list('-created_date', 1000);
      for (const msg of messages) {
        if (nonAdminUserIdArray.includes(msg.senderUserId)) {
          await base44.asServiceRole.entities.RoomMessage.delete(msg.id);
          stats.roomMessages++;
        }
      }
      console.log('    ✓ Deleted', stats.roomMessages, 'room messages');
    } catch (err) {
      console.log('    ⚠️ Error:', err.message);
    }
    
    // Delete Rooms
    console.log('  → Deleting Rooms...');
    try {
      const rooms = await base44.asServiceRole.entities.Room.list('-created_date', 1000);
      for (const room of rooms) {
        if (nonAdminUserIdArray.includes(room.investorId) || nonAdminUserIdArray.includes(room.agentId)) {
          await base44.asServiceRole.entities.Room.delete(room.id);
          stats.rooms++;
        }
      }
      console.log('    ✓ Deleted', stats.rooms, 'rooms');
    } catch (err) {
      console.log('    ⚠️ Error:', err.message);
    }
    
    // Delete Deals
    console.log('  → Deleting Deals...');
    try {
      const deals = await base44.asServiceRole.entities.Deal.list('-created_date', 1000);
      for (const deal of deals) {
        if (nonAdminUserIdArray.includes(deal.investor_id) || nonAdminUserIdArray.includes(deal.agent_id)) {
          await base44.asServiceRole.entities.Deal.delete(deal.id);
          stats.deals++;
        }
      }
      console.log('    ✓ Deleted', stats.deals, 'deals');
    } catch (err) {
      console.log('    ⚠️ Error:', err.message);
    }
    
    // Delete Reviews (if entity exists)
    console.log('  → Deleting Reviews...');
    try {
      const reviews = await base44.asServiceRole.entities.Review.list('-created_date', 1000);
      for (const review of reviews) {
        const reviewerIds = [review.reviewer_profile_id, review.reviewee_profile_id].filter(Boolean);
        if (reviewerIds.some(id => nonAdminUserIdArray.includes(id))) {
          await base44.asServiceRole.entities.Review.delete(review.id);
          stats.reviews++;
        }
      }
      console.log('    ✓ Deleted', stats.reviews, 'reviews');
    } catch (err) {
      console.log('    ⚠️ Review entity not found or error:', err.message);
    }
    
    // Delete AuditLogs
    console.log('  → Deleting AuditLogs...');
    try {
      const audits = await base44.asServiceRole.entities.AuditLog.list('-created_date', 1000);
      for (const audit of audits) {
        if (nonAdminUserIdArray.includes(audit.actor_id)) {
          await base44.asServiceRole.entities.AuditLog.delete(audit.id);
          stats.auditLogs++;
        }
      }
      console.log('    ✓ Deleted', stats.auditLogs, 'audit logs');
    } catch (err) {
      console.log('    ⚠️ Error:', err.message);
    }
    
    console.log('');
    
    // ========================================
    // STEP 5: DELETE PROFILE RECORDS
    // ========================================
    console.log('STEP 5: Deleting Profile records...');
    
    for (const profile of profilesToDelete) {
      try {
        console.log(`  → Deleting profile: ${profile.email} (id: ${profile.id})`);
        await base44.asServiceRole.entities.Profile.delete(profile.id);
        stats.profiles++;
      } catch (err) {
        console.log(`    ❌ FAILED to delete profile ${profile.email}: ${err.message}`);
      }
    }
    
    console.log('  ✓ Deleted', stats.profiles, 'profiles\n');

    // ========================================
    // STEP 5b: DELETE USER RECORDS (COMPLETE WIPE)
    // ========================================
    console.log('STEP 5b: Deleting User records (complete wipe)...');
    
    stats.users = 0;
    const userDeleteErrors = [];
    
    // Get all users to find the ones to delete
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    console.log('  ✓ Found', allUsers.length, 'total users in system');
    
    for (const user of allUsers) {
      // Skip if this user is an admin
      if (adminUserIds.has(user.id)) {
        console.log(`  → SKIPPING admin user: ${user.email}`);
        continue;
      }
      
      // Delete this non-admin user
      try {
        console.log(`  → Deleting user: ${user.email} (id: ${user.id})`);
        await base44.asServiceRole.entities.User.delete(user.id);
        stats.users++;
      } catch (err) {
        console.log(`    ❌ FAILED to delete user ${user.email}: ${err.message}`);
        userDeleteErrors.push({ email: user.email, error: err.message });
      }
    }
    
    console.log('  ✓ Deleted', stats.users, 'users');
    if (userDeleteErrors.length > 0) {
      console.log('  ⚠️ Failed to delete', userDeleteErrors.length, 'users');
    }
    console.log('');
    
    // ========================================
    // STEP 6: VERIFY DELETION
    // ========================================
    console.log('STEP 6: Verifying deletion...');
    
    const remainingProfiles = await base44.asServiceRole.entities.Profile.list('-created_date', 1000);
    console.log('✓ Profiles remaining in database:', remainingProfiles.length);
    console.log('  (Should only be admin profiles)');
    
    remainingProfiles.forEach(p => {
      console.log(`  - ${p.email} (role: ${p.role}, user_role: ${p.user_role})`);
    });
    
    console.log('');
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('=== RESET COMPLETE ===');
    console.log('Summary:');
    console.log(`  • Protected admins: ${adminUserIds.size}`);
    console.log(`  • Deleted profiles: ${stats.profiles}`);
    console.log(`  • Deleted users: ${stats.users}`);
    console.log(`  • Deleted matches: ${stats.matches}`);
    console.log(`  • Deleted intro requests: ${stats.introRequests}`);
    console.log(`  • Deleted rooms: ${stats.rooms}`);
    console.log(`  • Deleted messages: ${stats.roomMessages}`);
    console.log(`  • Deleted deals: ${stats.deals}`);
    console.log(`  • Deleted reviews: ${stats.reviews}`);
    console.log(`  • Deleted audit logs: ${stats.auditLogs}`);
    console.log('');
    
    return Response.json({
      ok: true,
      message: `Successfully deleted ${stats.profiles} profiles and ${stats.users} users for ${nonAdminUserIds.size} non-admin accounts`,
      deletedProfiles: stats.profiles,
      deletedUsers: stats.users,
      details: {
        protectedAdmins: adminUserIds.size,
        deletedMatches: stats.matches,
        deletedIntroRequests: stats.introRequests,
        deletedRooms: stats.rooms,
        deletedRoomMessages: stats.roomMessages,
        deletedDeals: stats.deals,
        deletedReviews: stats.reviews,
        deletedAuditLogs: stats.auditLogs,
      }
    });
    
  } catch (error) {
    console.error('\n❌ RESET FAILED:', error);
    console.error('Stack:', error.stack);
    console.error('');
    
    return Response.json({ 
      ok: false,
      error: error.message,
      message: 'Reset failed: ' + error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});