import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const PROTECTED_EMAILS = [
      'outtocreate@gmail.com',
      'mike4empire@gmail.com',
      'arturolefevre@yahoo.com',
      'mike4verve@gmail.com'
    ];

    // Get protected profile IDs
    const allProfiles = await base44.asServiceRole.entities.Profile.list();
    const protectedProfileIds = new Set(
      allProfiles
        .filter(p => PROTECTED_EMAILS.includes(p.email?.toLowerCase()))
        .map(p => p.id)
    );

    console.log(`[cleanup] Protected profile IDs: ${[...protectedProfileIds].join(', ')}`);

    // Get all deals
    const allDeals = await base44.asServiceRole.entities.Deal.list();
    console.log(`[cleanup] Total deals found: ${allDeals.length}`);

    // Find deals to delete: investor_id is NOT a protected profile
    const dealsToDelete = allDeals.filter(d => !protectedProfileIds.has(d.investor_id));
    // Also keep deals where a protected profile is the locked_agent_id
    const finalDealsToDelete = dealsToDelete.filter(d => !protectedProfileIds.has(d.locked_agent_id));

    console.log(`[cleanup] Deals to delete: ${finalDealsToDelete.length}`);

    let deletedDeals = 0;
    let deletedRooms = 0;
    let deletedMessages = 0;
    let deletedAgreements = 0;
    let deletedInvites = 0;
    let deletedCounters = 0;
    let deletedActivities = 0;
    let deletedAppointments = 0;
    const errors = [];

    const deleteWithRetry = async (entity, id, retries = 3) => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          await entity.delete(id);
          return true;
        } catch (err) {
          if (err?.message?.includes('Rate limit') && attempt < retries - 1) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          } else {
            throw err;
          }
        }
      }
    };

    for (let i = 0; i < finalDealsToDelete.length; i++) {
      const deal = finalDealsToDelete[i];
      try {
        const dealId = deal.id;

        // Delete rooms for this deal
        const rooms = await base44.asServiceRole.entities.Room.filter({ deal_id: dealId });
        for (const room of rooms) {
          // Delete messages in this room
          const messages = await base44.asServiceRole.entities.Message.filter({ room_id: room.id });
          for (const msg of messages) {
            await deleteWithRetry(base44.asServiceRole.entities.Message, msg.id);
            deletedMessages++;
            await new Promise(r => setTimeout(r, 100));
          }
          await deleteWithRetry(base44.asServiceRole.entities.Room, room.id);
          deletedRooms++;
          await new Promise(r => setTimeout(r, 200));
        }

        // Delete legal agreements
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: dealId });
        for (const ag of agreements) {
          await deleteWithRetry(base44.asServiceRole.entities.LegalAgreement, ag.id);
          deletedAgreements++;
          await new Promise(r => setTimeout(r, 100));
        }

        // Delete deal invites
        const invites = await base44.asServiceRole.entities.DealInvite.filter({ deal_id: dealId });
        for (const inv of invites) {
          await deleteWithRetry(base44.asServiceRole.entities.DealInvite, inv.id);
          deletedInvites++;
          await new Promise(r => setTimeout(r, 100));
        }

        // Delete counter offers
        const counters = await base44.asServiceRole.entities.CounterOffer.filter({ deal_id: dealId });
        for (const co of counters) {
          await deleteWithRetry(base44.asServiceRole.entities.CounterOffer, co.id);
          deletedCounters++;
          await new Promise(r => setTimeout(r, 100));
        }

        // Delete activities
        const activities = await base44.asServiceRole.entities.Activity.filter({ deal_id: dealId });
        for (const act of activities) {
          await deleteWithRetry(base44.asServiceRole.entities.Activity, act.id);
          deletedActivities++;
          await new Promise(r => setTimeout(r, 100));
        }

        // Delete deal appointments
        const appts = await base44.asServiceRole.entities.DealAppointments.filter({ dealId: dealId });
        for (const appt of appts) {
          await deleteWithRetry(base44.asServiceRole.entities.DealAppointments, appt.id);
          deletedAppointments++;
          await new Promise(r => setTimeout(r, 100));
        }

        // Delete the deal itself
        await deleteWithRetry(base44.asServiceRole.entities.Deal, dealId);
        deletedDeals++;
        console.log(`[cleanup] Deleted deal ${deletedDeals}: ${deal.title || deal.property_address || dealId}`);

        // Pause between deals
        if ((i + 1) % 3 === 0) {
          await new Promise(r => setTimeout(r, 3000));
        } else {
          await new Promise(r => setTimeout(r, 500));
        }

      } catch (err) {
        console.error(`[cleanup] Error on deal ${deal.id}:`, err.message);
        errors.push({ dealId: deal.id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      deletedDeals,
      deletedRooms,
      deletedMessages,
      deletedAgreements,
      deletedInvites,
      deletedCounters,
      deletedActivities,
      deletedAppointments,
      errors: errors.length > 0 ? errors : null,
      protectedProfileIds: [...protectedProfileIds]
    });

  } catch (error) {
    console.error('[cleanup] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});