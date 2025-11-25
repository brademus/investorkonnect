import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * RELEASE ESCROW FUNDS
 * 
 * Allows the buyer to accept the transaction and release funds to the seller
 * Must be called after inspection period
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
    const { room_id, action = 'accept' } = body; // action: 'accept' or 'reject'

    if (!room_id) {
      return Response.json({ 
        ok: false, 
        error: 'Missing room_id' 
      }, { status: 400 });
    }

    // Get room
    const rooms = await base44.entities.Room.filter({ id: room_id });
    if (rooms.length === 0) {
      return Response.json({ ok: false, error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];

    // Verify user is the investor (buyer)
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0) {
      return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];

    if (room.investorId !== profile.id) {
      return Response.json({ 
        ok: false, 
        error: 'Only the investor can release escrow funds' 
      }, { status: 403 });
    }

    if (!room.escrow_transaction_id) {
      return Response.json({ 
        ok: false, 
        error: 'No escrow transaction exists for this room' 
      }, { status: 400 });
    }

    // Verify escrow is in a releasable state
    const validStatuses = ['funded', 'inspection', 'accepted'];
    if (!validStatuses.includes(room.escrow_status)) {
      return Response.json({ 
        ok: false, 
        error: `Cannot release escrow in status: ${room.escrow_status}` 
      }, { status: 400 });
    }

    // Call Escrow.com API to accept/reject
    const endpoint = action === 'accept' 
      ? `${ESCROW_API_BASE}/transaction/${room.escrow_transaction_id}/accept`
      : `${ESCROW_API_BASE}/transaction/${room.escrow_transaction_id}/reject`;

    const escrowResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${ESCROW_API_KEY}:`)}`
      },
      body: JSON.stringify({
        customer: profile.email
      })
    });

    if (!escrowResponse.ok) {
      const errorData = await escrowResponse.json();
      console.error('[ReleaseEscrow] Error:', errorData);
      return Response.json({ 
        ok: false, 
        error: errorData.error || `Failed to ${action} escrow`,
        details: errorData
      }, { status: escrowResponse.status });
    }

    const escrowData = await escrowResponse.json();

    // Update room status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    await base44.asServiceRole.entities.Room.update(room.id, {
      escrow_status: newStatus,
      escrow_released_at: action === 'accept' ? new Date().toISOString() : null,
      escrow_rejected_at: action === 'reject' ? new Date().toISOString() : null,
      escrow_updated_at: new Date().toISOString()
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: profile.id,
      actor_name: profile.full_name || user.email,
      entity_type: 'Room',
      entity_id: room.id,
      action: `escrow_${action}ed`,
      details: JSON.stringify({
        transaction_id: room.escrow_transaction_id,
        action
      }),
      timestamp: new Date().toISOString()
    });

    // Notify the agent
    const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: room.agentId });
    if (agentProfiles[0]?.email) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: agentProfiles[0].email,
          subject: `AgentVault: Escrow ${action === 'accept' ? 'Released' : 'Rejected'}`,
          body: `
            <h2>Escrow ${action === 'accept' ? 'Released' : 'Rejected'}</h2>
            <p>The investor has ${action === 'accept' ? 'accepted the transaction and released' : 'rejected'} the escrow funds.</p>
            <p>Log in to AgentVault to view details.</p>
          `
        });
      } catch (emailErr) {
        console.warn('[ReleaseEscrow] Failed to send notification:', emailErr);
      }
    }

    return Response.json({
      ok: true,
      transaction_id: room.escrow_transaction_id,
      action,
      status: newStatus,
      escrow_data: escrowData
    });

  } catch (error) {
    console.error('[ReleaseEscrow] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});