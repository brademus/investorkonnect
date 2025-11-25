import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import crypto from 'node:crypto';

/**
 * ESCROW.COM WEBHOOK HANDLER
 * 
 * Receives and validates webhook events from Escrow.com
 * Updates Deal Room status based on escrow transaction events
 */

const WEBHOOK_SECRET = Deno.env.get("ESCROW_COM_WEBHOOK_SECRET");

// Verify Escrow.com webhook signature
function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.error('[EscrowWebhook] Missing ESCROW_COM_WEBHOOK_SECRET');
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature || '', 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );
}

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    
    // Verify webhook signature
    const signature = req.headers.get('X-Escrow-Signature') || req.headers.get('x-escrow-signature');
    
    if (!verifySignature(rawBody, signature)) {
      console.error('[EscrowWebhook] Invalid signature');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the event payload
    const event = JSON.parse(rawBody);
    
    console.log('[EscrowWebhook] Received event:', event.event_type, event);

    // Initialize Base44 client with service role for database operations
    const base44 = createClientFromRequest(req);

    // Extract transaction details
    const { event_type, transaction_id, data } = event;

    // Find the associated Deal Room by escrow_transaction_id
    const rooms = await base44.asServiceRole.entities.Room.filter({
      escrow_transaction_id: transaction_id
    });

    if (rooms.length === 0) {
      console.log('[EscrowWebhook] No room found for transaction:', transaction_id);
      // Still return 200 to acknowledge receipt
      return Response.json({ ok: true, message: 'No matching room found' });
    }

    const room = rooms[0];
    let updateData = {};
    let notificationMessage = null;

    // Handle different event types
    switch (event_type) {
      case 'transaction.created':
        updateData = {
          escrow_status: 'created',
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'Escrow transaction has been created';
        break;

      case 'funds.deposited':
      case 'buyer.funded':
        updateData = {
          escrow_status: 'funded',
          escrow_funded_at: new Date().toISOString(),
          escrow_funded_amount: data?.amount || 0,
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'Funds have been deposited into escrow';
        break;

      case 'inspection.started':
        updateData = {
          escrow_status: 'inspection',
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'Inspection period has started';
        break;

      case 'inspection.accepted':
      case 'buyer.accepted':
        updateData = {
          escrow_status: 'accepted',
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'Transaction has been accepted';
        break;

      case 'funds.disbursed':
      case 'funds.released':
        updateData = {
          escrow_status: 'disbursed',
          escrow_disbursed_at: new Date().toISOString(),
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'Funds have been released from escrow';
        break;

      case 'transaction.completed':
        updateData = {
          escrow_status: 'completed',
          escrow_completed_at: new Date().toISOString(),
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'Escrow transaction has been completed';
        break;

      case 'transaction.cancelled':
        updateData = {
          escrow_status: 'cancelled',
          escrow_cancelled_at: new Date().toISOString(),
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'Escrow transaction has been cancelled';
        break;

      case 'dispute.opened':
        updateData = {
          escrow_status: 'disputed',
          escrow_dispute_opened_at: new Date().toISOString(),
          escrow_updated_at: new Date().toISOString()
        };
        notificationMessage = 'A dispute has been opened on the escrow transaction';
        break;

      default:
        console.log('[EscrowWebhook] Unhandled event type:', event_type);
        updateData = {
          escrow_updated_at: new Date().toISOString(),
          escrow_last_event: event_type
        };
    }

    // Update the Room with escrow status
    await base44.asServiceRole.entities.Room.update(room.id, updateData);
    console.log('[EscrowWebhook] Updated room:', room.id, 'with:', updateData);

    // Create audit log entry
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: 'system',
        actor_name: 'Escrow.com Webhook',
        entity_type: 'Room',
        entity_id: room.id,
        action: `escrow_${event_type}`,
        details: JSON.stringify({ transaction_id, event_type, data }),
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('[EscrowWebhook] Failed to create audit log:', auditErr);
    }

    // Send notifications to participants
    if (notificationMessage) {
      try {
        // Get participant profiles
        const investorProfile = room.investorId ? 
          await base44.asServiceRole.entities.Profile.filter({ id: room.investorId }) : [];
        const agentProfile = room.agentId ?
          await base44.asServiceRole.entities.Profile.filter({ id: room.agentId }) : [];

        // Send email notifications via Core integration
        const recipients = [
          investorProfile[0]?.email,
          agentProfile[0]?.email
        ].filter(Boolean);

        for (const email of recipients) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject: `AgentVault Escrow Update: ${notificationMessage}`,
              body: `
                <h2>Escrow Transaction Update</h2>
                <p>${notificationMessage}</p>
                <p><strong>Transaction ID:</strong> ${transaction_id}</p>
                <p>Log in to your AgentVault account to view details.</p>
              `
            });
          } catch (emailErr) {
            console.warn('[EscrowWebhook] Failed to send email to:', email, emailErr);
          }
        }
      } catch (notifyErr) {
        console.warn('[EscrowWebhook] Failed to send notifications:', notifyErr);
      }
    }

    return Response.json({ 
      ok: true, 
      room_id: room.id,
      event_type,
      status: updateData.escrow_status 
    });

  } catch (error) {
    console.error('[EscrowWebhook] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});