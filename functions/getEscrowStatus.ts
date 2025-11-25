import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * GET ESCROW STATUS
 * 
 * Retrieves the current status of an escrow transaction from Escrow.com
 * and syncs it with the local Room entity
 */

const ESCROW_API_KEY = Deno.env.get("ESCROW_COM_API_KEY");
const ESCROW_API_BASE = "https://api.escrow.com/2017-09-01";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { room_id, transaction_id } = body;

    if (!room_id && !transaction_id) {
      return Response.json({ 
        ok: false, 
        error: 'Must provide room_id or transaction_id' 
      }, { status: 400 });
    }

    // Get room
    let room;
    if (room_id) {
      const rooms = await base44.entities.Room.filter({ id: room_id });
      room = rooms[0];
    } else {
      const rooms = await base44.entities.Room.filter({ escrow_transaction_id: transaction_id });
      room = rooms[0];
    }

    if (!room) {
      return Response.json({ ok: false, error: 'Room not found' }, { status: 404 });
    }

    // Verify user is participant
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0) {
      return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    const isParticipant = room.investorId === profile.id || room.agentId === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isParticipant && !isAdmin) {
      return Response.json({ ok: false, error: 'Not authorized' }, { status: 403 });
    }

    // If no escrow transaction exists
    if (!room.escrow_transaction_id) {
      return Response.json({
        ok: true,
        escrow_status: 'none',
        message: 'No escrow transaction for this room'
      });
    }

    // Fetch status from Escrow.com
    const escrowResponse = await fetch(
      `${ESCROW_API_BASE}/transaction/${room.escrow_transaction_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${ESCROW_API_KEY}:`)}`
        }
      }
    );

    if (!escrowResponse.ok) {
      // Return cached status if API call fails
      return Response.json({
        ok: true,
        escrow_status: room.escrow_status || 'unknown',
        transaction_id: room.escrow_transaction_id,
        cached: true,
        escrow_amount: room.escrow_amount,
        escrow_currency: room.escrow_currency,
        escrow_created_at: room.escrow_created_at,
        escrow_updated_at: room.escrow_updated_at
      });
    }

    const escrowData = await escrowResponse.json();

    // Map Escrow.com status to our internal status
    const statusMap = {
      'draft': 'created',
      'in_progress': 'in_progress',
      'funded': 'funded',
      'inspection': 'inspection',
      'complete': 'completed',
      'cancelled': 'cancelled',
      'disputed': 'disputed'
    };

    const mappedStatus = statusMap[escrowData.status] || escrowData.status;

    // Update room with latest status if changed
    if (mappedStatus !== room.escrow_status) {
      await base44.asServiceRole.entities.Room.update(room.id, {
        escrow_status: mappedStatus,
        escrow_updated_at: new Date().toISOString()
      });
    }

    return Response.json({
      ok: true,
      transaction_id: room.escrow_transaction_id,
      escrow_status: mappedStatus,
      escrow_amount: room.escrow_amount,
      escrow_currency: room.escrow_currency,
      escrow_created_at: room.escrow_created_at,
      escrow_updated_at: new Date().toISOString(),
      landing_page: room.escrow_landing_page,
      // Include party statuses
      parties: escrowData.parties?.map(p => ({
        role: p.role,
        agreed: p.agreed,
        funded: p.funded
      }))
    });

  } catch (error) {
    console.error('[GetEscrowStatus] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});