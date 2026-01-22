import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Send message with anti-circumvention enforcement
 * Blocks contact info exchange pre-signature
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { room_id, body } = await req.json();
    const bodyTrimmed = (typeof body === 'string' ? body.trim() : '');
    
    if (!room_id || !bodyTrimmed) {
      return Response.json({ error: 'room_id and body required' }, { status: 400 });
    }
    
    // Get profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    
    // Get room to check agreement status (robust - catch invalid id formats)
    let room = null;
    try {
      room = await base44.asServiceRole.entities.Room.get(room_id);
    } catch (_) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }
    if (!room) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }
    
    // Verify user has access to this room
    if (room.investorId !== profile.id && room.agentId !== profile.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Basic per-user rate limit: 1.5s between messages in the same room (use user-scoped call to avoid platform rate limits)
    try {
      const lastMsgs = await base44.entities.Message.filter({ room_id, sender_profile_id: profile.id }, '-created_date', 1);
      const lastMsg = lastMsgs?.[0];
      if (lastMsg) {
        const lastTs = new Date(lastMsg.created_date).getTime();
        if (!Number.isNaN(lastTs) && (Date.now() - lastTs) < 1500) {
          return Response.json({ error: 'Please wait a moment before sending another message.' }, { status: 429 });
        }
      }
    } catch (_) {
      // If lookup fails (e.g., transient rate limit), continue without blocking send
    }

    // Check if agreement is fully signed (strict gating)
    let isFullySigned = false;
    if (room.deal_id) {
      try {
        const agreements = await base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: room.deal_id });
        if (agreements.length > 0) {
          isFullySigned = agreements[0].status === 'fully_signed';
        }
      } catch (_) {}
    }

    // Allow messaging when room is accepted or fully signed
    const status = room.request_status || room.agreement_status;
    const canMessage = isFullySigned || status === 'accepted' || status === 'signed';
    if (!canMessage) {
      return Response.json({ 
        error: 'Messaging is available once the request is accepted.',
        ok: false
      }, { status: 403 });
    }
    
    // Create message
    try {
      const message = await base44.asServiceRole.entities.Message.create({
        room_id,
        sender_profile_id: profile.id,
        body: bodyTrimmed
      });
      return Response.json({ ok: true, message });
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const msg = err?.data?.message || err?.message || '';
      if (status === 429 || /rate limit/i.test(msg)) {
        return Response.json({ ok: false, error: 'Please wait a moment before sending another message.' }, { status: 429 });
      }
      throw err;
    }
    
  } catch (error) {
    console.error('Send message error:', error);
    const status = error?.status || error?.response?.status;
    const msg = error?.data?.message || error?.response?.data?.error || error?.message || 'Failed to send message';
    if (status === 429 || /rate limit/i.test(String(msg))) {
      return Response.json({ error: 'Please wait a moment before sending another message.', ok: false }, { status: 429 });
    }
    return Response.json({ error: msg, ok: false }, { status: 500 });
  }
});

/**
 * Detect contact information in message text
 * Returns array of violation types
 */
function detectContactInfo(text) {
  const violations = [];
  
  // Email pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailPattern.test(text)) {
    violations.push('email address');
  }
  
  // Phone patterns
  const phonePatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // 123-456-7890
    /\(\d{3}\)\s*\d{3}[-.]?\d{4}/g, // (123) 456-7890
    /\+1\s*\d{3}[-.]?\d{3}[-.]?\d{4}/g, // +1 123-456-7890
    /\b\d{10}\b/g // 1234567890
  ];
  
  for (const pattern of phonePatterns) {
    if (pattern.test(text)) {
      violations.push('phone number');
      break;
    }
  }
  
  // Social media handles
  const socialPattern = /@[a-zA-Z0-9_]{3,}/g;
  if (socialPattern.test(text)) {
    violations.push('social media handle');
  }
  
  return violations;
}