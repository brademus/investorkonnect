import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin-only: Delete all deals and associated data
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    if (!profile || profile.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    
    console.log('[adminDeleteAllDeals] Starting cleanup...');
    
    // Get all deals first
    const allDeals = await base44.asServiceRole.entities.Deal.list('-created_date', 1000);
    const dealIds = allDeals.map(d => d.id);
    
    console.log(`[adminDeleteAllDeals] Found ${dealIds.length} deals to delete`);
    
    // Delete all associated data in order of dependencies
    
    // 1. Messages
    const allMessages = await base44.asServiceRole.entities.Message.list('-created_date', 5000);
    const messagesToDelete = allMessages.filter(m => {
      const room = base44.asServiceRole.entities.Room.filter({ id: m.room_id }).then(r => r[0]);
      return !!room;
    });
    for (const msg of messagesToDelete) {
      try { await base44.asServiceRole.entities.Message.delete(msg.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${messagesToDelete.length} messages`);
    
    // 2. Activities
    const allActivities = await base44.asServiceRole.entities.Activity.list('-created_date', 5000);
    const activitiesToDelete = allActivities.filter(a => dealIds.includes(a.deal_id) || dealIds.includes(a.room_id));
    for (const act of activitiesToDelete) {
      try { await base44.asServiceRole.entities.Activity.delete(act.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${activitiesToDelete.length} activities`);
    
    // 3. CounterOffers
    const allCounters = await base44.asServiceRole.entities.CounterOffer.list('-created_date', 5000);
    const countersToDelete = allCounters.filter(c => dealIds.includes(c.deal_id));
    for (const counter of countersToDelete) {
      try { await base44.asServiceRole.entities.CounterOffer.delete(counter.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${countersToDelete.length} counter offers`);
    
    // 4. PaymentMilestones
    const allMilestones = await base44.asServiceRole.entities.PaymentMilestone.list('-created_date', 5000);
    const milestonesToDelete = allMilestones.filter(m => dealIds.includes(m.deal_id));
    for (const milestone of milestonesToDelete) {
      try { await base44.asServiceRole.entities.PaymentMilestone.delete(milestone.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${milestonesToDelete.length} payment milestones`);
    
    // 5. PaymentSchedules
    const allSchedules = await base44.asServiceRole.entities.PaymentSchedule.list('-created_date', 5000);
    const schedulesToDelete = allSchedules.filter(s => dealIds.includes(s.deal_id));
    for (const schedule of schedulesToDelete) {
      try { await base44.asServiceRole.entities.PaymentSchedule.delete(schedule.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${schedulesToDelete.length} payment schedules`);
    
    // 6. DealAppointments
    const allAppointments = await base44.asServiceRole.entities.DealAppointments.list('-updated_date', 5000);
    const appointmentsToDelete = allAppointments.filter(a => dealIds.includes(a.dealId));
    for (const appt of appointmentsToDelete) {
      try { await base44.asServiceRole.entities.DealAppointments.delete(appt.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${appointmentsToDelete.length} deal appointments`);
    
    // 7. LegalAgreements
    const allAgreements = await base44.asServiceRole.entities.LegalAgreement.list('-created_date', 5000);
    const agreementsToDelete = allAgreements.filter(a => dealIds.includes(a.deal_id));
    for (const agreement of agreementsToDelete) {
      try { await base44.asServiceRole.entities.LegalAgreement.delete(agreement.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${agreementsToDelete.length} legal agreements`);
    
    // 8. DealInvites
    const allInvites = await base44.asServiceRole.entities.DealInvite.list('-created_date', 5000);
    const invitesToDelete = allInvites.filter(i => dealIds.includes(i.deal_id));
    for (const invite of invitesToDelete) {
      try { await base44.asServiceRole.entities.DealInvite.delete(invite.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${invitesToDelete.length} deal invites`);
    
    // 9. Rooms
    const allRooms = await base44.asServiceRole.entities.Room.list('-created_date', 5000);
    const roomsToDelete = allRooms.filter(r => dealIds.includes(r.deal_id));
    for (const room of roomsToDelete) {
      try { await base44.asServiceRole.entities.Room.delete(room.id); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${roomsToDelete.length} rooms`);
    
    // 10. Deals (last)
    for (const dealId of dealIds) {
      try { await base44.asServiceRole.entities.Deal.delete(dealId); } catch (_) {}
    }
    console.log(`[adminDeleteAllDeals] Deleted ${dealIds.length} deals`);
    
    return Response.json({ 
      ok: true,
      deleted: {
        deals: dealIds.length,
        rooms: roomsToDelete.length,
        agreements: agreementsToDelete.length,
        invites: invitesToDelete.length,
        appointments: appointmentsToDelete.length,
        schedules: schedulesToDelete.length,
        milestones: milestonesToDelete.length,
        counters: countersToDelete.length,
        activities: activitiesToDelete.length,
        messages: messagesToDelete.length
      }
    });
    
  } catch (error) {
    console.error('[adminDeleteAllDeals] Error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
});