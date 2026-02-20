import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can call this
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const PROTECTED_EMAILS = ['outtocreate@gmail.com', 'mike4verve@gmail.com'];

    // Get all profiles
    const allProfiles = await base44.asServiceRole.entities.Profile.list();
    
    // Filter to profiles we should delete
    const profilesToDelete = allProfiles.filter(p => 
      !PROTECTED_EMAILS.includes(p.email?.toLowerCase())
    );

    console.log(`[deleteAllProfilesExcept] Found ${profilesToDelete.length} profiles to delete`);
    console.log(`[deleteAllProfilesExcept] Protected profiles: ${PROTECTED_EMAILS.join(', ')}`);

    let deletedCount = 0;
    const errors = [];

    // Delete each profile and related data with rate limit handling
    for (let i = 0; i < profilesToDelete.length; i++) {
      const profile = profilesToDelete[i];
      try {
        const profileId = profile.id;
        
        // Delete deals where this profile is investor
        const investorDeals = await base44.asServiceRole.entities.Deal.filter({ investor_id: profileId });
        for (const deal of investorDeals) {
          await base44.asServiceRole.entities.Deal.delete(deal.id);
          await new Promise(r => setTimeout(r, 50)); // Small delay between deletes
        }

        // Delete deals where this profile is agent
        const agentDeals = await base44.asServiceRole.entities.Deal.filter({ locked_agent_id: profileId });
        for (const deal of agentDeals) {
          await base44.asServiceRole.entities.Deal.delete(deal.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete rooms
        const rooms = await base44.asServiceRole.entities.Room.filter({ investorId: profileId });
        for (const room of rooms) {
          await base44.asServiceRole.entities.Room.delete(room.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete reviews as reviewer
        const reviewsAsReviewer = await base44.asServiceRole.entities.Review.filter({ reviewer_profile_id: profileId });
        for (const review of reviewsAsReviewer) {
          await base44.asServiceRole.entities.Review.delete(review.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete reviews as reviewee
        const reviewsAsReviewee = await base44.asServiceRole.entities.Review.filter({ reviewee_profile_id: profileId });
        for (const review of reviewsAsReviewee) {
          await base44.asServiceRole.entities.Review.delete(review.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete messages
        const messages = await base44.asServiceRole.entities.Message.filter({ sender_profile_id: profileId });
        for (const msg of messages) {
          await base44.asServiceRole.entities.Message.delete(msg.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete legal agreements
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ investor_profile_id: profileId });
        for (const agreement of agreements) {
          await base44.asServiceRole.entities.LegalAgreement.delete(agreement.id);
          await new Promise(r => setTimeout(r, 50));
        }

        const agentAgreements = await base44.asServiceRole.entities.LegalAgreement.filter({ agent_profile_id: profileId });
        for (const agreement of agentAgreements) {
          await base44.asServiceRole.entities.LegalAgreement.delete(agreement.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete deal invites
        const invites = await base44.asServiceRole.entities.DealInvite.filter({ agent_profile_id: profileId });
        for (const invite of invites) {
          await base44.asServiceRole.entities.DealInvite.delete(invite.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete deal drafts
        const drafts = await base44.asServiceRole.entities.DealDraft.filter({ investor_profile_id: profileId });
        for (const draft of drafts) {
          await base44.asServiceRole.entities.DealDraft.delete(draft.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete activity records
        const activities = await base44.asServiceRole.entities.Activity.filter({ actor_id: profileId });
        for (const activity of activities) {
          await base44.asServiceRole.entities.Activity.delete(activity.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete counter offers
        const counters = await base44.asServiceRole.entities.CounterOffer.filter({ from_profile_id: profileId });
        for (const counter of counters) {
          await base44.asServiceRole.entities.CounterOffer.delete(counter.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete payment schedules & milestones
        const schedules = await base44.asServiceRole.entities.PaymentSchedule.filter({ owner_profile_id: profileId });
        for (const schedule of schedules) {
          const milestones = await base44.asServiceRole.entities.PaymentMilestone.filter({ schedule_id: schedule.id });
          for (const milestone of milestones) {
            await base44.asServiceRole.entities.PaymentMilestone.delete(milestone.id);
            await new Promise(r => setTimeout(r, 30));
          }
          await base44.asServiceRole.entities.PaymentSchedule.delete(schedule.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete deal appointments
        const appointments = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: profileId });
        for (const appt of appointments) {
          await base44.asServiceRole.entities.DealAppointments.delete(appt.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete NDAs
        const ndas = await base44.asServiceRole.entities.NDA.filter({ user_id: profileId });
        for (const nda of ndas) {
          await base44.asServiceRole.entities.NDA.delete(nda.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Delete audit logs
        const auditLogs = await base44.asServiceRole.entities.AuditLog.filter({ actor_id: profileId });
        for (const log of auditLogs) {
          await base44.asServiceRole.entities.AuditLog.delete(log.id);
          await new Promise(r => setTimeout(r, 50));
        }

        // Finally, delete the profile itself
        await base44.asServiceRole.entities.Profile.delete(profileId);
        deletedCount++;
        console.log(`[deleteAllProfilesExcept] Deleted profile: ${profile.email}`);

        // Add delay between profile deletions to avoid rate limit
        if (i < profilesToDelete.length - 1) {
          await new Promise(r => setTimeout(r, 200));
        }

      } catch (err) {
        console.error(`[deleteAllProfilesExcept] Error deleting profile ${profile.email}:`, err.message);
        errors.push({ email: profile.email, error: err.message });
      }
    }

    return Response.json({
      success: true,
      deletedCount,
      protectedProfiles: PROTECTED_EMAILS,
      errors: errors.length > 0 ? errors : null,
      message: `Deleted ${deletedCount} profiles and all associated data`
    });

  } catch (error) {
    console.error('[deleteAllProfilesExcept] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});