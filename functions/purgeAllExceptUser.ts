import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin check
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const preserveEmail = 'bradenheller@gmail.com';
    console.log(`[Purge] Starting purge - preserving: ${preserveEmail}`);

    // Get the user to preserve
    const allUsers = await base44.asServiceRole.entities.User.list();
    const preserveUser = allUsers.find(u => u.email === preserveEmail);
    
    if (!preserveUser) {
      return Response.json({ error: `User ${preserveEmail} not found` }, { status: 404 });
    }

    const preserveUserId = preserveUser.id;
    console.log(`[Purge] Preserving user ID: ${preserveUserId}`);

    // Delete all profiles except the preserved user's profile
    const allProfiles = await base44.asServiceRole.entities.Profile.list();
    const otherProfiles = allProfiles.filter(p => p.user_id !== preserveUserId);
    
    for (const profile of otherProfiles) {
      console.log(`[Purge] Deleting profile: ${profile.id}`);
      await base44.asServiceRole.entities.Profile.delete(profile.id);
    }

    // Delete all deals
    const allDeals = await base44.asServiceRole.entities.Deal.list();
    for (const deal of allDeals) {
      console.log(`[Purge] Deleting deal: ${deal.id}`);
      
      // Delete related entities
      try {
        const messages = await base44.asServiceRole.entities.Message.filter({ room_id: deal.id });
        for (const msg of messages) await base44.asServiceRole.entities.Message.delete(msg.id);
      } catch (_) {}
      
      try {
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: deal.id });
        for (const room of rooms) await base44.asServiceRole.entities.Room.delete(room.id);
      } catch (_) {}
      
      try {
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: deal.id });
        for (const agreement of agreements) await base44.asServiceRole.entities.LegalAgreement.delete(agreement.id);
      } catch (_) {}
      
      try {
        const counters = await base44.asServiceRole.entities.CounterOffer.filter({ deal_id: deal.id });
        for (const counter of counters) await base44.asServiceRole.entities.CounterOffer.delete(counter.id);
      } catch (_) {}
      
      try {
        const activities = await base44.asServiceRole.entities.Activity.filter({ deal_id: deal.id });
        for (const activity of activities) await base44.asServiceRole.entities.Activity.delete(activity.id);
      } catch (_) {}
      
      try {
        const milestones = await base44.asServiceRole.entities.PaymentMilestone.filter({ deal_id: deal.id });
        for (const milestone of milestones) await base44.asServiceRole.entities.PaymentMilestone.delete(milestone.id);
      } catch (_) {}
      
      try {
        const schedules = await base44.asServiceRole.entities.PaymentSchedule.filter({ deal_id: deal.id });
        for (const schedule of schedules) await base44.asServiceRole.entities.PaymentSchedule.delete(schedule.id);
      } catch (_) {}
      
      // Delete the deal itself
      await base44.asServiceRole.entities.Deal.delete(deal.id);
    }

    // Delete all other users except the preserved one
    const otherUsers = allUsers.filter(u => u.id !== preserveUserId);
    for (const u of otherUsers) {
      console.log(`[Purge] Deleting user: ${u.email}`);
      try {
        await base44.asServiceRole.entities.User.delete(u.id);
      } catch (e) {
        console.warn(`[Purge] Could not delete user ${u.id}: ${e.message}`);
      }
    }

    console.log('[Purge] Complete');
    return Response.json({
      success: true,
      preserved_user: preserveEmail,
      deleted_profiles: otherProfiles.length,
      deleted_deals: allDeals.length,
      deleted_users: otherUsers.length
    });
  } catch (error) {
    console.error('[Purge] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});