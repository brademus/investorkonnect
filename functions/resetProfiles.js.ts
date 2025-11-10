import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * RESET ALL NON-ADMIN PROFILES - COMPREHENSIVE VERSION
 * 
 * ADMIN-ONLY: Deletes all investor/agent profiles and related data for non-admin users
 * Use this to start fresh with test data
 * 
 * CRITICAL: This does NOT delete admin users or their profiles
 * 
 * Deletes from:
 * - Profile (main user profiles)
 * - Room (deal rooms)
 * - RoomMessage (chat messages)
 * - Deal (deals)
 * - Match (investor-agent matches)
 * - IntroRequest (introduction requests)
 * - AuditLog (audit entries)
 */
Deno.serve(async (req) => {
  try {
    console.log('=== Reset Non-Admin Profiles (Comprehensive) ===');
    
    const base44 = createClientFromRequest(req);
    
    // STEP 1: Verify caller is admin
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false,
        reason: 'AUTH_REQUIRED',
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('Caller:', user.email);
    
    // Check if caller has admin privileges
    const callerProfiles = await base44.entities.Profile.filter({ user_id: user.id });
    
    if (callerProfiles.length === 0) {
      return Response.json({ 
        ok: false,
        reason: 'PROFILE_NOT_FOUND',
        message: 'Profile not found' 
      }, { status: 404 });
    }
    
    const callerProfile = callerProfiles[0];
    const isCallerAdmin = 
      callerProfile.role === 'admin' || 
      user.role === 'admin';
    
    if (!isCallerAdmin) {
      console.log('❌ Caller is not admin, role:', callerProfile.role);
      return Response.json({ 
        ok: false,
        reason: 'FORBIDDEN',
        message: 'Only admins can reset profiles' 
      }, { status: 403 });
    }
    
    console.log('✅ Caller is admin, proceeding with reset');
    
    // STEP 2: Identify all admin users (to protect them)
    const allProfiles = await base44.asServiceRole.entities.Profile.filter({});
    
    const adminUserIds = new Set();
    
    for (const profile of allProfiles) {
      // A user is admin if ANY of these are true
      const isAdmin = 
        profile.role === 'admin' || 
        profile.user_role === 'admin';
      
      if (isAdmin && profile.user_id) {
        adminUserIds.add(profile.user_id);
        console.log('Protected admin:', profile.email);
      }
    }
    
    console.log('Found', adminUserIds.size, 'admin users to protect');
    
    // STEP 3: Delete Profile rows for non-admin users
    const nonAdminProfiles = allProfiles.filter(p => 
      p.user_id && !adminUserIds.has(p.user_id)
    );
    
    console.log('Found', nonAdminProfiles.length, 'non-admin profiles to delete');
    
    let deletedProfileCount = 0;
    const nonAdminUserIds = new Set();
    
    for (const profile of nonAdminProfiles) {
      try {
        console.log('Deleting profile:', profile.email);
        await base44.asServiceRole.entities.Profile.delete(profile.id);
        deletedProfileCount++;
        if (profile.user_id) {
          nonAdminUserIds.add(profile.user_id);
        }
      } catch (err) {
        console.error('Failed to delete profile:', profile.email, err);
      }
    }
    
    console.log('✅ Deleted', deletedProfileCount, 'profiles');
    console.log('Identified', nonAdminUserIds.size, 'non-admin user IDs for cleanup');
    
    // STEP 4: Delete related data for non-admin users
    let deletedRooms = 0;
    let deletedMessages = 0;
    let deletedDeals = 0;
    let deletedMatches = 0;
    let deletedIntros = 0;
    let deletedAudits = 0;
    
    // Convert Set to Array for filtering
    const nonAdminUserIdArray = Array.from(nonAdminUserIds);
    
    // Delete Rooms (where investorId or agentId is non-admin)
    try {
      const allRooms = await base44.asServiceRole.entities.Room.filter({});
      for (const room of allRooms) {
        if (
          (room.investorId && nonAdminUserIdArray.includes(room.investorId)) ||
          (room.agentId && nonAdminUserIdArray.includes(room.agentId))
        ) {
          try {
            await base44.asServiceRole.entities.Room.delete(room.id);
            deletedRooms++;
          } catch (err) {
            console.error('Failed to delete room:', room.id, err);
          }
        }
      }
      console.log('✅ Deleted', deletedRooms, 'rooms');
    } catch (err) {
      console.error('Error deleting rooms:', err);
    }
    
    // Delete RoomMessages (where senderUserId is non-admin)
    try {
      const allMessages = await base44.asServiceRole.entities.RoomMessage.filter({});
      for (const message of allMessages) {
        if (message.senderUserId && nonAdminUserIdArray.includes(message.senderUserId)) {
          try {
            await base44.asServiceRole.entities.RoomMessage.delete(message.id);
            deletedMessages++;
          } catch (err) {
            console.error('Failed to delete message:', message.id, err);
          }
        }
      }
      console.log('✅ Deleted', deletedMessages, 'messages');
    } catch (err) {
      console.error('Error deleting messages:', err);
    }
    
    // Delete Deals (where investor_id or agent_id is non-admin)
    try {
      const allDeals = await base44.asServiceRole.entities.Deal.filter({});
      for (const deal of allDeals) {
        if (
          (deal.investor_id && nonAdminUserIdArray.includes(deal.investor_id)) ||
          (deal.agent_id && nonAdminUserIdArray.includes(deal.agent_id))
        ) {
          try {
            await base44.asServiceRole.entities.Deal.delete(deal.id);
            deletedDeals++;
          } catch (err) {
            console.error('Failed to delete deal:', deal.id, err);
          }
        }
      }
      console.log('✅ Deleted', deletedDeals, 'deals');
    } catch (err) {
      console.error('Error deleting deals:', err);
    }
    
    // Delete Matches (where investorId or agentId is non-admin)
    try {
      const allMatches = await base44.asServiceRole.entities.Match.filter({});
      for (const match of allMatches) {
        if (
          (match.investorId && nonAdminUserIdArray.includes(match.investorId)) ||
          (match.agentId && nonAdminUserIdArray.includes(match.agentId))
        ) {
          try {
            await base44.asServiceRole.entities.Match.delete(match.id);
            deletedMatches++;
          } catch (err) {
            console.error('Failed to delete match:', match.id, err);
          }
        }
      }
      console.log('✅ Deleted', deletedMatches, 'matches');
    } catch (err) {
      console.error('Error deleting matches:', err);
    }
    
    // Delete IntroRequests (where investorId or agentId is non-admin)
    try {
      const allIntros = await base44.asServiceRole.entities.IntroRequest.filter({});
      for (const intro of allIntros) {
        if (
          (intro.investorId && nonAdminUserIdArray.includes(intro.investorId)) ||
          (intro.agentId && nonAdminUserIdArray.includes(intro.agentId))
        ) {
          try {
            await base44.asServiceRole.entities.IntroRequest.delete(intro.id);
            deletedIntros++;
          } catch (err) {
            console.error('Failed to delete intro:', intro.id, err);
          }
        }
      }
      console.log('✅ Deleted', deletedIntros, 'intro requests');
    } catch (err) {
      console.error('Error deleting intro requests:', err);
    }
    
    // Delete AuditLogs (where actor_id is non-admin)
    try {
      const allAudits = await base44.asServiceRole.entities.AuditLog.filter({});
      for (const audit of allAudits) {
        if (audit.actor_id && nonAdminUserIdArray.includes(audit.actor_id)) {
          try {
            await base44.asServiceRole.entities.AuditLog.delete(audit.id);
            deletedAudits++;
          } catch (err) {
            console.error('Failed to delete audit:', audit.id, err);
          }
        }
      }
      console.log('✅ Deleted', deletedAudits, 'audit logs');
    } catch (err) {
      console.error('Error deleting audit logs:', err);
    }
    
    console.log('=== Reset Complete ===');
    console.log('Summary:');
    console.log('- Protected admins:', adminUserIds.size);
    console.log('- Deleted profiles:', deletedProfileCount);
    console.log('- Affected users:', nonAdminUserIds.size);
    console.log('- Deleted rooms:', deletedRooms);
    console.log('- Deleted messages:', deletedMessages);
    console.log('- Deleted deals:', deletedDeals);
    console.log('- Deleted matches:', deletedMatches);
    console.log('- Deleted intros:', deletedIntros);
    console.log('- Deleted audits:', deletedAudits);
    
    return Response.json({
      ok: true,
      message: 'Non-admin profiles reset successfully',
      deletedProfiles: deletedProfileCount,
      deletedUsers: nonAdminUserIds.size,
      details: {
        protectedAdmins: adminUserIds.size,
        deletedRooms,
        deletedMessages,
        deletedDeals,
        deletedMatches,
        deletedIntros,
        deletedAudits,
      }
    });
    
  } catch (error) {
    console.error('❌ Reset error:', error);
    return Response.json({ 
      ok: false,
      error: error.message,
      message: 'Reset failed: ' + error.message 
    }, { status: 500 });
  }
});