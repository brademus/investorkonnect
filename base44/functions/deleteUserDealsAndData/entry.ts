import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    // Find profile by email
    const profiles = await base44.asServiceRole.entities.Profile.filter({ email: email.toLowerCase().trim() });
    if (!profiles.length) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    const profileId = profile.id;

    console.log(`[deleteUserDealsAndData] Starting deletion for profile: ${profileId} (${email})`);

    // Get all deals associated with this investor
    const deals = await base44.asServiceRole.entities.Deal.filter({ investor_id: profileId });
    console.log(`[deleteUserDealsAndData] Found ${deals.length} deals`);

    // Get all rooms associated with these deals
    const rooms = await base44.asServiceRole.entities.Room.filter({ investorId: profileId });
    console.log(`[deleteUserDealsAndData] Found ${rooms.length} rooms`);

    const dealIds = deals.map(d => d.id);
    const roomIds = rooms.map(r => r.id);

    // Delete related entities in order of dependencies
    let deletedCount = 0;

    // 1. Delete Messages for these rooms
    if (roomIds.length > 0) {
      const messages = await base44.asServiceRole.entities.Message.filter({});
      const roomMessagesToDelete = messages.filter(m => roomIds.includes(m.room_id));
      for (const msg of roomMessagesToDelete) {
        try {
          await base44.asServiceRole.entities.Message.delete(msg.id);
          deletedCount++;
        } catch (e) {
          console.warn(`[deleteUserDealsAndData] Failed to delete message ${msg.id}: ${e.message}`);
        }
      }
      console.log(`[deleteUserDealsAndData] Deleted ${roomMessagesToDelete.length} messages`);
    }

    // 2. Delete LegalAgreements for these deals/rooms
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({});
    const agreementsToDelete = agreements.filter(a => dealIds.includes(a.deal_id) || roomIds.includes(a.room_id));
    for (const agreement of agreementsToDelete) {
      try {
        await base44.asServiceRole.entities.LegalAgreement.delete(agreement.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete agreement ${agreement.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${agreementsToDelete.length} agreements`);

    // 3. Delete CounterOffers for these deals/rooms
    const counteroffers = await base44.asServiceRole.entities.CounterOffer.filter({});
    const counteroffersToDelete = counteroffers.filter(c => dealIds.includes(c.deal_id) || roomIds.includes(c.room_id));
    for (const co of counteroffersToDelete) {
      try {
        await base44.asServiceRole.entities.CounterOffer.delete(co.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete counter offer ${co.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${counteroffersToDelete.length} counter offers`);

    // 4. Delete DealInvites for these deals
    const invites = await base44.asServiceRole.entities.DealInvite.filter({});
    const invitesToDelete = invites.filter(i => dealIds.includes(i.deal_id));
    for (const invite of invitesToDelete) {
      try {
        await base44.asServiceRole.entities.DealInvite.delete(invite.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete invite ${invite.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${invitesToDelete.length} deal invites`);

    // 5. Delete DealAppointments for these deals
    const appointments = await base44.asServiceRole.entities.DealAppointments.filter({});
    const appointmentsToDelete = appointments.filter(a => dealIds.includes(a.dealId));
    for (const apt of appointmentsToDelete) {
      try {
        await base44.asServiceRole.entities.DealAppointments.delete(apt.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete appointment ${apt.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${appointmentsToDelete.length} appointments`);

    // 6. Delete DealDrafts for this investor
    const drafts = await base44.asServiceRole.entities.DealDraft.filter({ investor_profile_id: profileId });
    for (const draft of drafts) {
      try {
        await base44.asServiceRole.entities.DealDraft.delete(draft.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete draft ${draft.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${drafts.length} drafts`);

    // 7. Delete PaymentSchedules and PaymentMilestones for these deals
    const schedules = await base44.asServiceRole.entities.PaymentSchedule.filter({});
    const schedulesToDelete = schedules.filter(s => dealIds.includes(s.deal_id));
    for (const schedule of schedulesToDelete) {
      try {
        await base44.asServiceRole.entities.PaymentSchedule.delete(schedule.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete schedule ${schedule.id}: ${e.message}`);
      }
    }

    const milestones = await base44.asServiceRole.entities.PaymentMilestone.filter({});
    const milestonesToDelete = milestones.filter(m => dealIds.includes(m.deal_id));
    for (const milestone of milestonesToDelete) {
      try {
        await base44.asServiceRole.entities.PaymentMilestone.delete(milestone.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete milestone ${milestone.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${schedulesToDelete.length} schedules and ${milestonesToDelete.length} milestones`);

    // 8. Delete Rooms
    for (const room of rooms) {
      try {
        await base44.asServiceRole.entities.Room.delete(room.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete room ${room.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${rooms.length} rooms`);

    // 9. Delete Deals
    for (const deal of deals) {
      try {
        await base44.asServiceRole.entities.Deal.delete(deal.id);
        deletedCount++;
      } catch (e) {
        console.warn(`[deleteUserDealsAndData] Failed to delete deal ${deal.id}: ${e.message}`);
      }
    }
    console.log(`[deleteUserDealsAndData] Deleted ${deals.length} deals`);

    return Response.json({
      success: true,
      message: `Deleted all deals and associated data for ${email}`,
      summary: {
        deals: deals.length,
        rooms: rooms.length,
        messages: agreementsToDelete.length,
        agreements: agreementsToDelete.length,
        counteroffers: counteroffersToDelete.length,
        invites: invitesToDelete.length,
        appointments: appointmentsToDelete.length,
        drafts: drafts.length,
        schedules: schedulesToDelete.length,
        milestones: milestonesToDelete.length,
        totalDeleted: dealIds.length + roomIds.length + deletedCount
      }
    });
  } catch (error) {
    console.error('[deleteUserDealsAndData] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});