import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * INITIATE ESCROW TRANSACTION
 * 
 * Creates a new Escrow.com transaction for a Deal Room
 * Links the escrow transaction to the room for status tracking
 */

const ESCROW_API_KEY = Deno.env.get("ESCROW_COM_API_KEY");
const ESCROW_API_BASE = "https://api.escrow.com/2017-09-01";
// Use sandbox for testing: "https://api.escrow-sandbox.com/2017-09-01"

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      room_id, 
      amount, 
      description,
      inspection_period_days = 3,
      currency = 'usd'
    } = body;

    if (!room_id || !amount) {
      return Response.json({ 
        ok: false, 
        error: 'Missing required fields: room_id, amount' 
      }, { status: 400 });
    }

    // Get the room and verify user is a participant
    const rooms = await base44.entities.Room.filter({ id: room_id });
    if (rooms.length === 0) {
      return Response.json({ ok: false, error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];

    // Get user's profile to check participation
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0) {
      return Response.json({ ok: false, error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    const isParticipant = room.investorId === profile.id || room.agentId === profile.id;

    if (!isParticipant) {
      return Response.json({ ok: false, error: 'Not a participant in this room' }, { status: 403 });
    }

    // Check if escrow already exists for this room
    if (room.escrow_transaction_id) {
      return Response.json({ 
        ok: false, 
        error: 'Escrow transaction already exists for this room',
        transaction_id: room.escrow_transaction_id 
      }, { status: 400 });
    }

    // Get both participant profiles for escrow parties
    const investorProfiles = await base44.asServiceRole.entities.Profile.filter({ id: room.investorId });
    const agentProfiles = await base44.asServiceRole.entities.Profile.filter({ id: room.agentId });

    const investor = investorProfiles[0];
    const agent = agentProfiles[0];

    if (!investor || !agent) {
      return Response.json({ 
        ok: false, 
        error: 'Could not find both participants' 
      }, { status: 400 });
    }

    // Create Escrow.com transaction
    const escrowPayload = {
      currency: currency.toLowerCase(),
      description: description || `AgentVault Deal Room Transaction - ${room_id}`,
      parties: [
        {
          role: "buyer",
          customer: investor.email,
          agreed: false
        },
        {
          role: "seller", 
          customer: agent.email,
          agreed: false
        },
        {
          role: "broker",
          customer: "platform@agentvault.com", // Platform as broker
          agreed: true
        }
      ],
      items: [
        {
          type: "general_merchandise",
          description: description || "Real Estate Investment Services",
          schedule: [
            {
              amount: parseFloat(amount),
              payer_customer: investor.email,
              beneficiary_customer: agent.email
            }
          ],
          inspection_period: inspection_period_days * 24 * 60 * 60 // Convert to seconds
        }
      ]
    };

    console.log('[InitiateEscrow] Creating transaction:', escrowPayload);

    // Call Escrow.com API
    const escrowResponse = await fetch(`${ESCROW_API_BASE}/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${ESCROW_API_KEY}:`)}`
      },
      body: JSON.stringify(escrowPayload)
    });

    const escrowData = await escrowResponse.json();

    if (!escrowResponse.ok) {
      console.error('[InitiateEscrow] Escrow.com error:', escrowData);
      return Response.json({ 
        ok: false, 
        error: escrowData.error || 'Failed to create escrow transaction',
        details: escrowData
      }, { status: escrowResponse.status });
    }

    console.log('[InitiateEscrow] Escrow transaction created:', escrowData);

    // Update room with escrow transaction details
    await base44.asServiceRole.entities.Room.update(room.id, {
      escrow_transaction_id: escrowData.id,
      escrow_status: 'created',
      escrow_amount: amount,
      escrow_currency: currency,
      escrow_created_at: new Date().toISOString(),
      escrow_landing_page: escrowData.landing_page
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: profile.id,
      actor_name: profile.full_name || user.email,
      entity_type: 'Room',
      entity_id: room.id,
      action: 'escrow_initiated',
      details: JSON.stringify({
        transaction_id: escrowData.id,
        amount,
        currency
      }),
      timestamp: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      transaction_id: escrowData.id,
      landing_page: escrowData.landing_page,
      status: 'created'
    });

  } catch (error) {
    console.error('[InitiateEscrow] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});