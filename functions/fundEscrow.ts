import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * FUND ESCROW TRANSACTION
 * 
 * Generates a payment link for the buyer to fund the escrow
 * Supports both Escrow.com direct funding and Stripe as a fallback
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
    const { room_id, payment_method = 'wire' } = body;

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
        error: 'Only the investor can fund the escrow' 
      }, { status: 403 });
    }

    if (!room.escrow_transaction_id) {
      return Response.json({ 
        ok: false, 
        error: 'No escrow transaction exists for this room' 
      }, { status: 400 });
    }

    // Get payment instructions from Escrow.com
    const escrowResponse = await fetch(
      `${ESCROW_API_BASE}/transaction/${room.escrow_transaction_id}/payment_methods`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${ESCROW_API_KEY}:`)}`
        }
      }
    );

    if (!escrowResponse.ok) {
      const errorData = await escrowResponse.json();
      console.error('[FundEscrow] Error getting payment methods:', errorData);
      
      // Return the landing page as fallback
      return Response.json({
        ok: true,
        payment_url: room.escrow_landing_page,
        payment_method: 'escrow_portal',
        message: 'Please complete payment on Escrow.com'
      });
    }

    const paymentMethods = await escrowResponse.json();

    // Find the requested payment method
    const selectedMethod = paymentMethods.find(m => m.type === payment_method) || paymentMethods[0];

    // Update room to track funding initiation
    await base44.asServiceRole.entities.Room.update(room.id, {
      escrow_funding_initiated_at: new Date().toISOString(),
      escrow_payment_method: selectedMethod?.type || payment_method
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: profile.id,
      actor_name: profile.full_name || user.email,
      entity_type: 'Room',
      entity_id: room.id,
      action: 'escrow_funding_initiated',
      details: JSON.stringify({
        transaction_id: room.escrow_transaction_id,
        payment_method: selectedMethod?.type || payment_method
      }),
      timestamp: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      transaction_id: room.escrow_transaction_id,
      payment_methods: paymentMethods,
      selected_method: selectedMethod,
      payment_url: room.escrow_landing_page,
      amount: room.escrow_amount,
      currency: room.escrow_currency
    });

  } catch (error) {
    console.error('[FundEscrow] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});