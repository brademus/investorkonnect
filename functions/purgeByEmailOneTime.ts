import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ONE-TIME ADMIN CLEANUP FUNCTION
// Deletes Users, Profiles, and ALL associated data for the specified emails.
// IMPORTANT: This function is intended to be invoked ONCE, then left in place or removed.

const EMAILS = [
  'bryceheller922@gmail.com',
  'wwbryceheller@outlook.com',
  'wwwbryceheller@outlook.com',
  'luxurystop.corp@gmail.com',
  'bh651097@gmail.com',
  'brycegenralbiz@gmail.com',
  'hellerbryce781@gmail.com',
].map(e => e.toLowerCase().trim());

async function deleteArray(asServiceRole, entityName, items, key = 'id', results, resultsKey) {
  if (!items || items.length === 0) return;
  let count = 0;
  for (const item of items) {
    try {
      await asServiceRole.entities[entityName].delete(item[key]);
      count++;
    } catch (_) {}
  }
  results[resultsKey] = (results[resultsKey] || 0) + count;
}

async function fetchAll(asServiceRole, entityName, filter) {
  try {
    const rows = await asServiceRole.entities[entityName].filter(filter);
    return Array.isArray(rows) ? rows : [];
  } catch (_) { return []; }
}

Deno.serve(async (req) => {
  const startedAt = new Date().toISOString();
  const results = { startedAt, emails: EMAILS, users: 0, profiles: 0, deals: 0, rooms: 0, messages: 0, roomMessages: 0, activities: 0, agreements: 0, offers: 0, milestones: 0, schedules: 0, contracts: 0, roomParticipants: 0 };

  try {
    const base44 = createClientFromRequest(req);

    // NOTE: We intentionally do NOT require end-user auth for this one-time purge.
    // We operate with service role to ensure complete cleanup.
    const asSR = base44.asServiceRole;

    for (const email of EMAILS) {
      // Locate User and Profile
      const userRows = await fetchAll(asSR, 'User', { email });
      const user = userRows[0] || null;

      let profile = (await fetchAll(asSR, 'Profile', { email }))[0] || null;
      if (!profile && user) {
        profile = (await fetchAll(asSR, 'Profile', { user_id: user.id }))[0] || null;
      }

      // If profile exists, purge all related data
      if (profile) {
        const pid = profile.id;

        // Deals where this profile is investor or agent
        const investorDeals = await fetchAll(asSR, 'Deal', { investor_id: pid });
        const agentDeals = await fetchAll(asSR, 'Deal', { agent_id: pid });
        const allDeals = [...investorDeals, ...agentDeals];

        // Rooms where this profile is investor or agent
        const investorRooms = await fetchAll(asSR, 'Room', { investorId: pid });
        const agentRooms = await fetchAll(asSR, 'Room', { agentId: pid });
        const allRooms = [...investorRooms, ...agentRooms];

        // Also include rooms for the deals (defensive)
        const dealIds = [...new Set(allDeals.map(d => d.id))];
        if (dealIds.length) {
          for (const did of dealIds) {
            const dealRooms = await fetchAll(asSR, 'Room', { deal_id: did });
            for (const r of dealRooms) {
              if (!allRooms.find(x => x.id === r.id)) allRooms.push(r);
            }
          }
        }

        // Purge per-room children
        for (const room of allRooms) {
          const rid = room.id;
          const msgs = await fetchAll(asSR, 'Message', { room_id: rid });
          const legacyMsgs = await fetchAll(asSR, 'RoomMessage', { roomId: rid });
          const acts = await fetchAll(asSR, 'Activity', { room_id: rid });
          const cons = await fetchAll(asSR, 'Contract', { room_id: rid });
          const participants = await fetchAll(asSR, 'RoomParticipant', { room_id: rid });

          await deleteArray(asSR, 'Message', msgs, 'id', results, 'messages');
          await deleteArray(asSR, 'RoomMessage', legacyMsgs, 'id', results, 'roomMessages');
          await deleteArray(asSR, 'Activity', acts, 'id', results, 'activities');
          await deleteArray(asSR, 'Contract', cons, 'id', results, 'contracts');
          await deleteArray(asSR, 'RoomParticipant', participants, 'id', results, 'roomParticipants');

          try { await asSR.entities.Room.delete(rid); results.rooms++; } catch (_) {}
        }

        // Purge per-deal children
        for (const deal of allDeals) {
          const did = deal.id;

          const agreements = await fetchAll(asSR, 'LegalAgreement', { deal_id: did });
          const offers = await fetchAll(asSR, 'CounterOffer', { deal_id: did });
          const schedules = await fetchAll(asSR, 'PaymentSchedule', { deal_id: did });
          const milestones = await fetchAll(asSR, 'PaymentMilestone', { deal_id: did });
          const actsByDeal = await fetchAll(asSR, 'Activity', { deal_id: did });

          await deleteArray(asSR, 'LegalAgreement', agreements, 'id', results, 'agreements');
          await deleteArray(asSR, 'CounterOffer', offers, 'id', results, 'offers');
          await deleteArray(asSR, 'PaymentMilestone', milestones, 'id', results, 'milestones');
          await deleteArray(asSR, 'PaymentSchedule', schedules, 'id', results, 'schedules');
          await deleteArray(asSR, 'Activity', actsByDeal, 'id', results, 'activities');

          try { await asSR.entities.Deal.delete(did); results.deals++; } catch (_) {}
        }

        // Finally, delete the profile itself
        try { await asSR.entities.Profile.delete(pid); results.profiles++; } catch (_) {}
      }

      // Delete the auth user last
      if (user) {
        try { await asSR.entities.User.delete(user.id); results.users++; } catch (_) {}
      }
    }

    return Response.json({ success: true, ...results, finishedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ success: false, error: error.message, ...results, failedAt: new Date().toISOString() }, { status: 500 });
  }
});