import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Persona Finalize - Server-side verification after embedded flow completes
 * Called from client after Persona widget reports completion
 * Validates with Persona API and updates profile
 */
Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ 
        error: 'Unauthorized' 
      }, { status: 401, headers });
    }

    // Get request body
    const body = await req.json();
    const { inquiryId, status: clientStatus } = body;

    if (!inquiryId) {
      return Response.json({ 
        error: 'Missing inquiryId' 
      }, { status: 400, headers });
    }

    console.log('[personaFinalize] Processing:', {
      user: user.email,
      inquiryId,
      clientStatus
    });

    // Get user's profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0) {
      return Response.json({ 
        error: 'Profile not found' 
      }, { status: 404, headers });
    }

    const profile = profiles[0];

    // Verify with Persona API (server-side validation)
    const personaApiKey = Deno.env.get('PERSONA_API_KEY');
    if (!personaApiKey) {
      console.error('[personaFinalize] PERSONA_API_KEY not set');
      return Response.json({ 
        error: 'Server configuration error' 
      }, { status: 500, headers });
    }

    let serverStatus = 'pending';
    
    try {
      console.log('[personaFinalize] Calling Persona API...');
      
      const personaResponse = await fetch(
        `https://withpersona.com/api/v1/inquiries/${inquiryId}`,
        {
          headers: {
            'Authorization': `Bearer ${personaApiKey}`,
            'Accept': 'application/json',
            'Persona-Version': '2023-01-05'
          }
        }
      );

      if (!personaResponse.ok) {
        console.error('[personaFinalize] Persona API error:', personaResponse.status);
        throw new Error(`Persona API returned ${personaResponse.status}`);
      }

      const personaData = await personaResponse.json();
      const inquiry = personaData.data;
      const inquiryStatus = inquiry.attributes?.status;

      console.log('[personaFinalize] Persona API response:', {
        inquiryId,
        status: inquiryStatus
      });

      // Map Persona status to our kyc_status
      switch (inquiryStatus) {
        case 'completed':
        case 'approved':
          serverStatus = 'approved';
          break;
        case 'pending':
        case 'created':
          serverStatus = 'pending';
          break;
        case 'failed':
        case 'declined':
          serverStatus = 'failed';
          break;
        case 'needs_review':
        case 'reviewing':
          serverStatus = 'needs_review';
          break;
        default:
          console.warn('[personaFinalize] Unknown status:', inquiryStatus);
          serverStatus = 'pending';
      }

    } catch (personaError) {
      console.error('[personaFinalize] Persona API call failed:', personaError);
      // If we can't verify with API, use client-reported status cautiously
      serverStatus = clientStatus === 'completed' ? 'pending' : 'failed';
    }

    // Update profile
    const updates = {
      kyc_status: serverStatus,
      kyc_provider: 'persona',
      kyc_inquiry_id: inquiryId,
      kyc_last_checked: new Date().toISOString()
    };

    // Only set verified_at if approved
    if (serverStatus === 'approved') {
      updates.kyc_verified = true;
      updates.verified_at = new Date().toISOString();
    }

    await base44.asServiceRole.entities.Profile.update(profile.id, updates);

    console.log('[personaFinalize] Updated profile:', {
      email: profile.email,
      kyc_status: serverStatus
    });

    // Create audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id,
        actor_name: profile.full_name || user.email,
        entity_type: 'Profile',
        entity_id: profile.id,
        action: `kyc_${serverStatus}`,
        details: `Persona verification completed: inquiry ${inquiryId} -> status ${serverStatus}`,
        timestamp: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('[personaFinalize] Failed to log audit:', auditErr);
    }

    return Response.json({ 
      ok: true,
      kyc_status: serverStatus,
      inquiry_id: inquiryId
    }, { status: 200, headers });

  } catch (error) {
    console.error('[personaFinalize] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500, headers });
  }
});