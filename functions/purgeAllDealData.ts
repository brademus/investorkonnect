import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin via user.role or Profile.role
    let isAdmin = user.role === 'admin';
    if (!isAdmin) {
      try {
        const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
        const profile = profiles?.[0];
        isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin';
      } catch (_) {
        // ignore, fallback to user.role check
      }
    }

    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const deleteAllBatched = async (entityName) => {
      let total = 0;
      // Keep fetching + deleting until none remain (handles pagination)
      while (true) {
        const items = await base44.asServiceRole.entities[entityName].list();
        if (!items || items.length === 0) break;
        for (const item of items) {
          await base44.asServiceRole.entities[entityName].delete(item.id);
          total++;
        }
      }
      return total;
    };

    const tryDelete = async (entityName, resultsKey) => {
      try {
        const count = await deleteAllBatched(entityName);
        return [resultsKey, count];
      } catch (e) {
        // Entity may not exist in this app; record as 0
        return [resultsKey, 0];
      }
    };

    const results = {};

    // Child data first
    const pairs = await Promise.all([
      tryDelete('RoomMessage', 'roomMessages'),
      tryDelete('Message', 'messages'),
      tryDelete('RoomParticipant', 'roomParticipants'),
      tryDelete('Activity', 'activities'),
      tryDelete('Contract', 'contracts'),
      tryDelete('LegalAgreement', 'legalAgreements'),
      tryDelete('PaymentMilestone', 'paymentMilestones'),
      tryDelete('PaymentSchedule', 'paymentSchedules'),
      tryDelete('DealAppointments', 'dealAppointments'),
      tryDelete('CounterOffer', 'counterOffers'),
    ]);
    for (const [k, v] of pairs) results[k] = v;

    // Rooms then Deals
    results.rooms = await deleteAllBatched('Room');
    results.deals = await deleteAllBatched('Deal');

    return Response.json({ success: true, cleared: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});