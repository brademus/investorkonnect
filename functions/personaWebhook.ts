import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Persona Webhook Handler
 * Maps Persona inquiry events to AgentVault kyc_status
 * Status mapping:
 * - unverified: default, no verification attempted
 * - pending: inquiry created/started
 * - approved: verification passed
 * - needs_review: manual review required
 * - failed: verification failed
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify webhook signature
    const webhookSecret = Deno.env.get('PERSONA_WEBHOOK_SECRET');
    if (webhookSecret) {
      const signature = req.headers.get('X-Persona-Signature') || req.headers.get('persona-signature');
      if (!signature) {
        console.error('[personaWebhook] Missing signature');
        return Response.json({ error: 'Missing signature' }, { status: 401 });
      }
      // In production, verify signature with crypto
      // For now, we accept if secret exists and signature is present
    } else {
      console.log('[personaWebhook] Running without signature verification (dev mode)');
    }

    // Parse webhook payload
    const payload = await req.json();
    console.log('[personaWebhook] Received event:', JSON.stringify(payload, null, 2));

    const eventType = payload.data?.type;
    const attributes = payload.data?.attributes || {};
    
    // Extract reference ID (user_id)
    const refId = attributes.referenceId || attributes.reference_id || attributes['reference-id'];
    const inquiryId = payload.data?.id;
    const inquiryStatus = attributes.status;

    if (!refId) {
      console.error('[personaWebhook] No reference ID found');
      return Response.json({ error: 'No reference ID' }, { status: 400 });
    }

    console.log('[personaWebhook] Processing:', {
      eventType,
      refId,
      inquiryId,
      inquiryStatus
    });

    // Determine kyc_status based on event and status
    let kycStatus = 'unverified';

    // Map event types and inquiry status to our kyc_status
    switch (eventType) {
      case 'inquiry.created':
      case 'inquiry.started':
        kycStatus = 'pending';
        break;
      
      case 'inquiry.completed':
        if (inquiryStatus === 'approved' || inquiryStatus === 'completed') {
          kycStatus = 'approved';
        } else if (inquiryStatus === 'failed' || inquiryStatus === 'declined') {
          kycStatus = 'failed';
        } else if (inquiryStatus === 'needs_review') {
          kycStatus = 'needs_review';
        } else {
          kycStatus = 'pending'; // Default for unknown completed status
        }
        break;
      
      case 'inquiry.failed':
      case 'inquiry.expired':
        kycStatus = 'failed';
        break;
      
      case 'inquiry.marked_for_review':
      case 'inquiry.reviewing':
        kycStatus = 'needs_review';
        break;
      
      case 'inquiry.approved':
        kycStatus = 'approved';
        break;
      
      case 'inquiry.declined':
        kycStatus = 'failed';
        break;
      
      default:
        console.log('[personaWebhook] Unhandled event type:', eventType);
        return Response.json({ received: true }, { status: 200 });
    }

    console.log('[personaWebhook] Mapped to kyc_status:', kycStatus);

    // Find and update profile by user_id
    const profiles = await base44.asServiceRole.entities.Profile.filter({
      user_id: refId
    });

    if (profiles.length === 0) {
      console.error('[personaWebhook] Profile not found for user_id:', refId);
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profiles[0];

    // Update profile with KYC status
    const updates = {
      kyc_provider: 'persona',
      kyc_inquiry_id: inquiryId,
      kyc_last_checked: new Date().toISOString(),
      kyc_status: kycStatus
    };

    await base44.asServiceRole.entities.Profile.update(profile.id, updates);

    console.log('[personaWebhook] Updated profile:', {
      email: profile.email,
      kyc_status: kycStatus,
      event: eventType
    });

    // Create audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: 'system',
        actor_name: 'Persona Webhook',
        entity_type: 'Profile',
        entity_id: profile.id,
        action: `kyc_${kycStatus}`,
        details: `Persona ${eventType}: inquiry ${inquiryId} -> status ${kycStatus}`,
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('[personaWebhook] Failed to log audit:', auditErr);
    }

    return Response.json({ 
      success: true,
      profile_id: profile.id,
      kyc_status: kycStatus
    }, { status: 200 });

  } catch (error) {
    console.error('[personaWebhook] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});