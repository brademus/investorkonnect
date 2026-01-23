import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * RESET ALL NON-ADMIN DATA - COMPLETE DATABASE WIPE
 * 
 * ADMIN-ONLY: Completely wipes all non-admin data from the system.
 * 
 * This function performs a TRUE deletion equivalent to manually deleting
 * records in the Base44 dashboard:
 * 
 * 1. Identifies admin users/profiles to protect
 * 2. Deletes ALL dependent entities first (messages, rooms, matches, etc.)
 * 3. Deletes ALL Profile records for non-admin users
 * 4. Note: User records in Base44's built-in User entity cannot be deleted via SDK
 *    (they have built-in security rules), but wiping the Profile makes them "new users"
 * 
 * After this runs, non-admin users will be treated as brand new when they log in
 * because their Profile (which tracks onboarding, role, etc.) is deleted.
 */
Deno.serve(async (req) => {
  console.log('\n========================================');
  console.log('RESET NON-ADMIN DATA - NUCLEAR WIPE');
  console.log('========================================\n');
  
  try {
    const base44 = createClientFromRequest(req);
    
    // ========================================
    // STEP 1: VERIFY ADMIN ACCESS
    // ========================================
    console.log('[STEP 1] Verifying admin access...');
    
    const currentUser = await base44.auth.me();
    
    if (!currentUser) {
      console.log('❌ No authenticated user');
      return Response.json({ 
        success: false,
        ok: false,
        error: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log(`✓ Current user: ${currentUser.email} (id: ${currentUser.id})`);
    
    // Check admin via Profile.role or User.role
    const currentProfiles = await base44.asServiceRole.entities.Profile.filter({ 
      user_id: currentUser.id 
    });
    const currentProfile = currentProfiles[0];
    
    const isAdmin = 
      currentUser.role === 'admin' || 
      currentProfile?.role === 'admin';
    
    if (!isAdmin) {
      console.log('❌ User is not admin');
      return Response.json({ 
        success: false,
        ok: false,
        error: 'Admin access required' 
      }, { status: 403 });
    }
    
    console.log('✅ Admin access confirmed\n');
    
    // ========================================
    // STEP 2: BUILD ADMIN PROTECTION SET
    // ========================================
    console.log('[STEP 2] Building admin protection list...');
    
    // Get ALL Users and ALL Profiles
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 10000);
    const allProfiles = await base44.asServiceRole.entities.Profile.list('-created_date', 10000);
    
    console.log(`✓ Found ${allUsers.length} total users`);
    console.log(`✓ Found ${allProfiles.length} total profiles`);
    
    // Build set of admin user_ids to PROTECT (never delete)
    const adminUserIds = new Set();
    const adminProfileIds = new Set();
    
    // Add admins from User.role
    for (const user of allUsers) {
      if (user.role === 'admin') {
        adminUserIds.add(user.id);
        console.log(`  → Protected admin (User.role): ${user.email}`);
      }
    }
    
    // Add admins from Profile.role
    for (const profile of allProfiles) {
      if (profile.role === 'admin' && profile.user_id) {
        adminUserIds.add(profile.user_id);
        adminProfileIds.add(profile.id);
        console.log(`  → Protected admin (Profile.role): ${profile.email}`);
      }
    }
    
    console.log(`✅ Total protected admins: ${adminUserIds.size}\n`);
    
    // ========================================
    // STEP 3: IDENTIFY NON-ADMIN DATA TO DELETE
    // ========================================
    console.log('[STEP 3] Identifying non-admin data to delete...');
    
    // Get non-admin profile IDs
    const nonAdminProfiles = allProfiles.filter(p => !adminUserIds.has(p.user_id));
    const nonAdminProfileIds = new Set(nonAdminProfiles.map(p => p.id));
    const nonAdminUserIds = new Set(nonAdminProfiles.map(p => p.user_id).filter(Boolean));
    
    console.log(`✓ Non-admin profiles to delete: ${nonAdminProfiles.length}`);
    console.log(`✓ Non-admin user_ids: ${nonAdminUserIds.size}`);
    
    if (nonAdminProfiles.length === 0) {
      console.log('⚠️ No non-admin data to delete\n');
      return Response.json({
        success: true,
        ok: true,
        message: 'No non-admin data found to delete',
        deletedProfiles: 0,
        deletedUsers: 0,
        details: {
          protectedAdmins: adminUserIds.size,
          remainingUsers: allUsers.length,
          remainingProfiles: adminProfileIds.size
        }
      });
    }
    
    // Log what will be deleted
    console.log('\nProfiles to delete:');
    nonAdminProfiles.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.email || 'no-email'} (profile_id: ${p.id})`);
    });
    console.log('');
    
    // ========================================
    // STEP 4: CASCADE DELETE ALL RELATED DATA
    // ========================================
    console.log('[STEP 4] Deleting all related entity data...\n');
    
    const stats = {
      profileVectors: 0,
      messages: 0,
      roomMessages: 0,
      roomParticipants: 0,
      rooms: 0,
      matches: 0,
      introRequests: 0,
      deals: 0,
      contracts: 0,
      paymentSchedules: 0,
      paymentMilestones: 0,
      reviews: 0,
      ndas: 0,
      auditLogs: 0,
      profiles: 0,
    };
    
    // Helper to delete entity records that reference non-admin profiles/users
    const deleteByProfileId = async (entityName, fieldName, set) => {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
        let deleted = 0;
        for (const record of records) {
          if (set.has(record[fieldName])) {
            await base44.asServiceRole.entities[entityName].delete(record.id);
            deleted++;
          }
        }
        console.log(`  ✓ Deleted ${deleted} ${entityName} records`);
        return deleted;
      } catch (err) {
        console.log(`  ⚠️ ${entityName}: ${err.message}`);
        return 0;
      }
    };
    
    const deleteByMultipleFields = async (entityName, fields, set) => {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 10000);
        let deleted = 0;
        for (const record of records) {
          const shouldDelete = fields.some(field => set.has(record[field]));
          if (shouldDelete) {
            await base44.asServiceRole.entities[entityName].delete(record.id);
            deleted++;
          }
        }
        console.log(`  ✓ Deleted ${deleted} ${entityName} records`);
        return deleted;
      } catch (err) {
        console.log(`  ⚠️ ${entityName}: ${err.message}`);
        return 0;
      }
    };
    
    // Delete in dependency order (leaf entities first)
    
    // 1. ProfileVector - references profile_id
    console.log('Deleting ProfileVector...');
    stats.profileVectors = await deleteByProfileId('ProfileVector', 'profile_id', nonAdminProfileIds);
    
    // 2. Message - references sender_profile_id  
    console.log('Deleting Message...');
    stats.messages = await deleteByProfileId('Message', 'sender_profile_id', nonAdminProfileIds);
    
    // 3. RoomMessage - references senderUserId (user_id, not profile_id)
    console.log('Deleting RoomMessage...');
    stats.roomMessages = await deleteByProfileId('RoomMessage', 'senderUserId', nonAdminUserIds);
    
    // 4. RoomParticipant - references profile_id
    console.log('Deleting RoomParticipant...');
    stats.roomParticipants = await deleteByProfileId('RoomParticipant', 'profile_id', nonAdminProfileIds);
    
    // 5. Room - references investorId, agentId (these are profile IDs in this app)
    console.log('Deleting Room...');
    stats.rooms = await deleteByMultipleFields('Room', ['investorId', 'agentId'], nonAdminProfileIds);
    
    // 6. Match - references investorId, agentId (profile IDs)
    console.log('Deleting Match...');
    stats.matches = await deleteByMultipleFields('Match', ['investorId', 'agentId'], nonAdminProfileIds);
    
    // 7. IntroRequest - references investorId, agentId (profile IDs)
    console.log('Deleting IntroRequest...');
    stats.introRequests = await deleteByMultipleFields('IntroRequest', ['investorId', 'agentId'], nonAdminProfileIds);
    
    // 8. Deal - references investor_id, agent_id
    console.log('Deleting Deal...');
    stats.deals = await deleteByMultipleFields('Deal', ['investor_id', 'agent_id'], nonAdminProfileIds);
    
    // 9. Contract - references created_by_profile_id
    console.log('Deleting Contract...');
    stats.contracts = await deleteByProfileId('Contract', 'created_by_profile_id', nonAdminProfileIds);
    
    // 10. PaymentSchedule - references owner_profile_id
    console.log('Deleting PaymentSchedule...');
    stats.paymentSchedules = await deleteByProfileId('PaymentSchedule', 'owner_profile_id', nonAdminProfileIds);
    
    // 11. PaymentMilestone - references payer_profile_id, payee_profile_id
    console.log('Deleting PaymentMilestone...');
    stats.paymentMilestones = await deleteByMultipleFields('PaymentMilestone', ['payer_profile_id', 'payee_profile_id'], nonAdminProfileIds);
    
    // 12. Review - references reviewer_profile_id, reviewee_profile_id
    console.log('Deleting Review...');
    stats.reviews = await deleteByMultipleFields('Review', ['reviewer_profile_id', 'reviewee_profile_id'], nonAdminProfileIds);
    
    // 13. NDA - references user_id
    console.log('Deleting NDA...');
    stats.ndas = await deleteByProfileId('NDA', 'user_id', nonAdminUserIds);
    
    // 14. AuditLog - references actor_id (profile_id)
    console.log('Deleting AuditLog...');
    stats.auditLogs = await deleteByProfileId('AuditLog', 'actor_id', nonAdminProfileIds);
    
    console.log('');
    
    // ========================================
    // STEP 5: DELETE PROFILE RECORDS
    // ========================================
    console.log('[STEP 5] Deleting Profile records...\n');
    
    for (const profile of nonAdminProfiles) {
      try {
        console.log(`  → Deleting: ${profile.email || profile.id}`);
        await base44.asServiceRole.entities.Profile.delete(profile.id);
        stats.profiles++;
      } catch (err) {
        console.log(`  ❌ Failed: ${profile.email} - ${err.message}`);
      }
    }
    
    console.log(`\n✅ Deleted ${stats.profiles} profiles\n`);
    
    // ========================================
    // STEP 6: VERIFY RESULTS
    // ========================================
    console.log('[STEP 6] Verifying deletion...\n');
    
    const remainingProfiles = await base44.asServiceRole.entities.Profile.list('-created_date', 10000);
    const remainingUsers = await base44.asServiceRole.entities.User.list('-created_date', 10000);
    
    console.log(`Remaining profiles: ${remainingProfiles.length}`);
    remainingProfiles.forEach(p => {
      console.log(`  - ${p.email} (role: ${p.role})`);
    });
    
    console.log(`\nRemaining users: ${remainingUsers.length}`);
    remainingUsers.forEach(u => {
      console.log(`  - ${u.email} (role: ${u.role})`);
    });
    
    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n========================================');
    console.log('RESET COMPLETE - SUMMARY');
    console.log('========================================');
    console.log(`Protected admins: ${adminUserIds.size}`);
    console.log(`Deleted profiles: ${stats.profiles}`);
    console.log(`Deleted profile vectors: ${stats.profileVectors}`);
    console.log(`Deleted messages: ${stats.messages}`);
    console.log(`Deleted room messages: ${stats.roomMessages}`);
    console.log(`Deleted room participants: ${stats.roomParticipants}`);
    console.log(`Deleted rooms: ${stats.rooms}`);
    console.log(`Deleted matches: ${stats.matches}`);
    console.log(`Deleted intro requests: ${stats.introRequests}`);
    console.log(`Deleted deals: ${stats.deals}`);
    console.log(`Deleted contracts: ${stats.contracts}`);
    console.log(`Deleted payment schedules: ${stats.paymentSchedules}`);
    console.log(`Deleted payment milestones: ${stats.paymentMilestones}`);
    console.log(`Deleted reviews: ${stats.reviews}`);
    console.log(`Deleted NDAs: ${stats.ndas}`);
    console.log(`Deleted audit logs: ${stats.auditLogs}`);
    console.log(`Remaining profiles: ${remainingProfiles.length}`);
    console.log(`Remaining users: ${remainingUsers.length}`);
    console.log('========================================\n');
    
    return Response.json({
      success: true,
      ok: true,
      message: `Deleted ${stats.profiles} profiles and all related data. ${remainingProfiles.length} admin profiles remain.`,
      deletedProfiles: stats.profiles,
      deletedUsers: 0, // Can't delete User records via SDK - they have built-in security
      details: {
        protectedAdmins: adminUserIds.size,
        profileVectors: stats.profileVectors,
        messages: stats.messages,
        roomMessages: stats.roomMessages,
        roomParticipants: stats.roomParticipants,
        rooms: stats.rooms,
        matches: stats.matches,
        introRequests: stats.introRequests,
        deals: stats.deals,
        contracts: stats.contracts,
        paymentSchedules: stats.paymentSchedules,
        paymentMilestones: stats.paymentMilestones,
        reviews: stats.reviews,
        ndas: stats.ndas,
        auditLogs: stats.auditLogs,
        remainingProfiles: remainingProfiles.length,
        remainingUsers: remainingUsers.length,
      }
    });
    
  } catch (error) {
    console.error('\n❌ RESET FAILED:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      success: false,
      ok: false,
      error: error.message,
    }, { status: 500 });
  }
});