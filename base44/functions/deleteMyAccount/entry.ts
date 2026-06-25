import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    if (!profiles.length) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    const profileId = profile.id;

    console.log(`[deleteMyAccount] Starting self-deletion for profile: ${profileId} (${user.email})`);

    let deletedCount = 0;

    // Gather deals/rooms where this user is the investor
    const deals = await base44.asServiceRole.entities.Deal.filter({ investor_id: profileId });
    const rooms = await base44.asServiceRole.entities.Room.filter({ investorId: profileId });
    const dealIds = deals.map(d => d.id);
    const roomIds = rooms.map(r => r.id);

    // Messages
    for (const rid of roomIds) {
      const msgs = await base44.asServiceRole.entities.Message.filter({ room_id: rid });
      for (const msg of msgs) {
        try { await base44.asServiceRole.entities.Message.delete(msg.id); deletedCount++; } catch (_) {}
      }
    }

    // LegalAgreements
    const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({});
    for (const a of agreements.filter(a => dealIds.includes(a.deal_id) || roomIds.includes(a.room_id))) {
      try { await base44.asServiceRole.entities.LegalAgreement.delete(a.id); deletedCount++; } catch (_) {}
    }

    // CounterOffers
    const counteroffers = await base44.asServiceRole.entities.CounterOffer.filter({});
    for (const c of counteroffers.filter(c => dealIds.includes(c.deal_id) || roomIds.includes(c.room_id))) {
      try { await base44.asServiceRole.entities.CounterOffer.delete(c.id); deletedCount++; } catch (_) {}
    }

    // DealInvites
    const invites = await base44.asServiceRole.entities.DealInvite.filter({});
    for (const i of invites.filter(i => dealIds.includes(i.deal_id))) {
      try { await base44.asServiceRole.entities.DealInvite.delete(i.id); deletedCount++; } catch (_) {}
    }

    // DealAppointments
    const appointments = await base44.asServiceRole.entities.DealAppointments.filter({});
    for (const a of appointments.filter(a => dealIds.includes(a.dealId))) {
      try { await base44.asServiceRole.entities.DealAppointments.delete(a.id); deletedCount++; } catch (_) {}
    }

    // DealDrafts
    const drafts = await base44.asServiceRole.entities.DealDraft.filter({ investor_profile_id: profileId });
    for (const d of drafts) {
      try { await base44.asServiceRole.entities.DealDraft.delete(d.id); deletedCount++; } catch (_) {}
    }

    // Rooms
    for (const room of rooms) {
      try { await base44.asServiceRole.entities.Room.delete(room.id); deletedCount++; } catch (_) {}
    }

    // Deals
    for (const deal of deals) {
      try { await base44.asServiceRole.entities.Deal.delete(deal.id); deletedCount++; } catch (_) {}
    }

    // Finally, delete the user's own Profile record
    try {
      await base44.asServiceRole.entities.Profile.delete(profileId);
      deletedCount++;
    } catch (e) {
      console.warn(`[deleteMyAccount] Failed to delete profile ${profileId}: ${e.message}`);
    }

    console.log(`[deleteMyAccount] Completed. Deleted ${deletedCount} records for ${user.email}`);

    return Response.json({
      success: true,
      message: 'Your account data has been deleted.',
      deletedCount
    });
  } catch (error) {
    console.error('[deleteMyAccount] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});