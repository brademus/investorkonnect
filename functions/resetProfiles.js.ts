import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * RESET ALL NON-ADMIN PROFILES - COMPREHENSIVE
 * 
 * ADMIN-ONLY: Deletes all investor/agent profiles AND related data for non-admin users
 * Use this to start fresh with test data
 * 
 * CRITICAL: This does NOT delete admin users or their profiles
 * 
 * Deletes from:
 * - Profile (main user profiles)
 * - Match (investor-agent matches)
 * - IntroRequest (introduction requests)
 * - Room (deal rooms)
 * - RoomMessage (chat messages)
 * - Deal (deals)
 * - Review (reviews)
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Reset Non-Admin Profiles (COMPREHENSIVE) ===');
    
    const base44 = createClientFromRequest(req);
    
    // 1. VERIFY CURRENT USER IS ADMIN
    const currentUser = await base44.auth.me();
    
    if (!currentUser) {
      console.log('❌ Not authenticated');
      return Response.json({ 
        ok: false,
        reason: 'AUTH_REQUIRED',
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('👤 Current user:', currentUser.email);
    
    // Check if current user is admin using ALL possible methods
    let isAdmin = false;
    
    // Method 1: Check auth user role
    if (currentUser.role === 'admin') {
      console.log('✅ User is admin (via auth.role)');
      isAdmin = true;
    }
    
    // Method 2: Check profile role
    const currentUserProfiles = await base44.entities.Profile.filter({ 
      user_id: currentUser.id 
    });
    
    if (currentUserProfiles.length > 0) {
      const currentProfile = currentUserProfiles[0];
      
      if (currentProfile.role === 'admin') {
        console.log('✅ User is admin (via profile.role)');
        isAdmin = true;
      }
      
      if (currentProfile.user_role === 'admin') {
        console.log('✅ User is admin (via profile.user_role)');
        isAdmin = true;
      }
    }
    
    if (!isAdmin) {
      console.log('❌ User is not admin, access denied');
      return Response.json({ 
        ok: false,
        reason: 'FORBIDDEN',
        message: 'Only admins can reset profiles' 
      }, { status: 403 });
    }
    
    console.log('✅ Admin access confirmed, proceeding with reset');
    
    // 2. IDENTIFY ALL ADMIN USER IDs
    console.log('\n📋 Step 1: Identifying admin users...');
    
    const allProfiles = await base44.asServiceRole.entities.Profile.filter({});
    console.log('Found', allProfiles.length, 'total profiles');
    
    // Build set of admin user IDs using ALL possible indicators
    const adminUserIds = new Set();
    
    for (const profile of allProfiles) {
      // Check multiple fields that might indicate admin
      if (
        profile.role === 'admin' ||
        profile.user_role === 'admin' ||
        profile.isAdmin === true
      ) {
        adminUserIds.add(profile.user_id);
        console.log('  ✓ Admin:', profile.email, '(user_id:', profile.user_id, ')');
      }
    }
    
    console.log('📊 Found', adminUserIds.size, 'admin users to protect');
    
    // 3. IDENTIFY ALL NON-ADMIN PROFILES
    console.log('\n📋 Step 2: Identifying non-admin profiles...');
    
    const nonAdminProfiles = allProfiles.filter(p => !adminUserIds.has(p.user_id));
    const nonAdminUserIds = new Set(nonAdminProfiles.map(p => p.user_id));
    
    console.log('📊 Found', nonAdminProfiles.length, 'non-admin profiles to delete');
    console.log('📊 Affecting', nonAdminUserIds.size, 'non-admin users');
    
    if (nonAdminProfiles.length === 0) {
      console.log('⚠️ No non-admin profiles to delete');
      return Response.json({
        ok: true,
        message: 'No non-admin profiles found',
        deletedProfiles: 0,
        deletedUsers: 0,
        deletedRelated: {
          matches: 0,
          introRequests: 0,
          rooms: 0,
          roomMessages: 0,
          deals: 0,
          reviews: 0,
        }
      });
    }
    
    const deletionStats = {
      profiles: 0,
      matches: 0,
      introRequests: 0,
      rooms: 0,
      roomMessages: 0,
      deals: 0,
      reviews: 0,
      errors: []
    };
    
    // 4. DELETE RELATED DATA FIRST (to avoid FK constraints)
    console.log('\n🗑️  Step 3: Deleting related data...');
    
    // Delete Matches
    try {
      console.log('  Deleting Match records...');
      const allMatches = await base44.asServiceRole.entities.Match.filter({});
      for (const match of allMatches) {
        if (nonAdminUserIds.has(match.investorId) || nonAdminUserIds.has(match.agentId)) {
          try {
            await base44.asServiceRole.entities.Match.delete(match.id);
            deletionStats.matches++;
          } catch (err) {
            console.error('    Failed to delete match:', err.message);
            deletionStats.errors.push({ entity: 'Match', id: match.id, error: err.message });
          }
        }
      }
      console.log('    ✓ Deleted', deletionStats.matches, 'matches');
    } catch (err) {
      console.error('  ⚠️ Error loading matches:', err.message);
    }
    
    // Delete IntroRequests
    try {
      console.log('  Deleting IntroRequest records...');
      const allIntroRequests = await base44.asServiceRole.entities.IntroRequest.filter({});
      for (const intro of allIntroRequests) {
        if (nonAdminUserIds.has(intro.investorId) || nonAdminUserIds.has(intro.agentId)) {
          try {
            await base44.asServiceRole.entities.IntroRequest.delete(intro.id);
            deletionStats.introRequests++;
          } catch (err) {
            console.error('    Failed to delete intro request:', err.message);
            deletionStats.errors.push({ entity: 'IntroRequest', id: intro.id, error: err.message });
          }
        }
      }
      console.log('    ✓ Deleted', deletionStats.introRequests, 'intro requests');
    } catch (err) {
      console.error('  ⚠️ Error loading intro requests:', err.message);
    }
    
    // Delete RoomMessages first (before Rooms)
    try {
      console.log('  Deleting RoomMessage records...');
      const allRoomMessages = await base44.asServiceRole.entities.RoomMessage.filter({});
      for (const msg of allRoomMessages) {
        if (nonAdminUserIds.has(msg.senderUserId)) {
          try {
            await base44.asServiceRole.entities.RoomMessage.delete(msg.id);
            deletionStats.roomMessages++;
          } catch (err) {
            console.error('    Failed to delete room message:', err.message);
            deletionStats.errors.push({ entity: 'RoomMessage', id: msg.id, error: err.message });
          }
        }
      }
      console.log('    ✓ Deleted', deletionStats.roomMessages, 'room messages');
    } catch (err) {
      console.error('  ⚠️ Error loading room messages:', err.message);
    }
    
    // Delete Rooms
    try {
      console.log('  Deleting Room records...');
      const allRooms = await base44.asServiceRole.entities.Room.filter({});
      for (const room of allRooms) {
        if (nonAdminUserIds.has(room.investorId) || nonAdminUserIds.has(room.agentId)) {
          try {
            await base44.asServiceRole.entities.Room.delete(room.id);
            deletionStats.rooms++;
          } catch (err) {
            console.error('    Failed to delete room:', err.message);
            deletionStats.errors.push({ entity: 'Room', id: room.id, error: err.message });
          }
        }
      }
      console.log('    ✓ Deleted', deletionStats.rooms, 'rooms');
    } catch (err) {
      console.error('  ⚠️ Error loading rooms:', err.message);
    }
    
    // Delete Deals
    try {
      console.log('  Deleting Deal records...');
      const allDeals = await base44.asServiceRole.entities.Deal.filter({});
      for (const deal of allDeals) {
        // Check if deal involves non-admin users
        const involvedUserIds = [
          deal.investor_id,
          deal.agent_id,
          ...(deal.participants || [])
        ].filter(Boolean);
        
        const hasNonAdmin = involvedUserIds.some(id => nonAdminUserIds.has(id));
        
        if (hasNonAdmin) {
          try {
            await base44.asServiceRole.entities.Deal.delete(deal.id);
            deletionStats.deals++;
          } catch (err) {
            console.error('    Failed to delete deal:', err.message);
            deletionStats.errors.push({ entity: 'Deal', id: deal.id, error: err.message });
          }
        }
      }
      console.log('    ✓ Deleted', deletionStats.deals, 'deals');
    } catch (err) {
      console.error('  ⚠️ Error loading deals:', err.message);
    }
    
    // Check if Review entity exists and delete if so
    try {
      console.log('  Checking for Review records...');
      const allReviews = await base44.asServiceRole.entities.Review.filter({});
      for (const review of allReviews) {
        // Assume reviews have reviewer_id and reviewee_id or similar
        const reviewerIds = [
          review.reviewer_id,
          review.reviewee_id,
          review.author_id,
          review.subject_id
        ].filter(Boolean);
        
        const hasNonAdmin = reviewerIds.some(id => nonAdminUserIds.has(id));
        
        if (hasNonAdmin) {
          try {
            await base44.asServiceRole.entities.Review.delete(review.id);
            deletionStats.reviews++;
          } catch (err) {
            console.error('    Failed to delete review:', err.message);
            deletionStats.errors.push({ entity: 'Review', id: review.id, error: err.message });
          }
        }
      }
      console.log('    ✓ Deleted', deletionStats.reviews, 'reviews');
    } catch (err) {
      // Review entity might not exist, that's OK
      console.log('  ⚠️ Review entity not found or error:', err.message);
    }
    
    // 5. DELETE PROFILE RECORDS
    console.log('\n🗑️  Step 4: Deleting Profile records...');
    
    for (const profile of nonAdminProfiles) {
      try {
        console.log('  Deleting profile:', profile.email, '(user_id:', profile.user_id, ')');
        await base44.asServiceRole.entities.Profile.delete(profile.id);
        deletionStats.profiles++;
      } catch (err) {
        console.error('    ❌ Failed to delete profile:', profile.email, err.message);
        deletionStats.errors.push({ 
          entity: 'Profile', 
          id: profile.id, 
          email: profile.email,
          error: err.message 
        });
      }
    }
    
    console.log('    ✓ Deleted', deletionStats.profiles, 'profiles');
    
    // 6. SUMMARY
    console.log('\n✅ Reset complete!');
    console.log('📊 Summary:');
    console.log('  - Profiles deleted:', deletionStats.profiles);
    console.log('  - Users affected:', nonAdminUserIds.size);
    console.log('  - Matches deleted:', deletionStats.matches);
    console.log('  - Intro requests deleted:', deletionStats.introRequests);
    console.log('  - Rooms deleted:', deletionStats.rooms);
    console.log('  - Room messages deleted:', deletionStats.roomMessages);
    console.log('  - Deals deleted:', deletionStats.deals);
    console.log('  - Reviews deleted:', deletionStats.reviews);
    console.log('  - Errors:', deletionStats.errors.length);
    
    if (deletionStats.errors.length > 0) {
      console.log('\n⚠️ Errors during deletion:');
      deletionStats.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.entity} ${err.id}: ${err.error}`);
      });
    }
    
    return Response.json({
      ok: true,
      message: 'Non-admin profiles reset successfully',
      deletedProfiles: deletionStats.profiles,
      deletedUsers: nonAdminUserIds.size,
      deletedRelated: {
        matches: deletionStats.matches,
        introRequests: deletionStats.introRequests,
        rooms: deletionStats.rooms,
        roomMessages: deletionStats.roomMessages,
        deals: deletionStats.deals,
        reviews: deletionStats.reviews,
      },
      errors: deletionStats.errors.length > 0 ? deletionStats.errors : undefined,
    });
    
  } catch (error) {
    console.error('❌ Reset error:', error);
    return Response.json({ 
      ok: false,
      reason: 'SERVER_ERROR',
      message: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
});