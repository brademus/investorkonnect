import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * Persona Poll - Check status of a Persona inquiry
 * Called from client after Persona redirect to get current status
 */
Deno.serve(async (req) => {
  const appOrigin = Deno.env.get('APP_BASE_URL') || 'https://agent-vault-da3d088b.base44.app';
  
  const headers = {
    'Access-Control-Allow-Origin': appOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    // Get inquiry ID from query params
    const url = new URL(req.url);
    const inquiryId = url.searchParams.get('inquiryId');

    if (!inquiryId) {
      return Response.json({ error: 'Missing inquiryId parameter' }, { status: 400, headers });
    }

    console.log('[personaPoll] Checking inquiry:', inquiryId, 'for user:', user.id);

    // Get user's profile
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
    if (profiles.length === 0) {
      return Response.json({ error: 'Profile not found' }, { status: 404, headers });
    }

    const profile = profiles[0];

    // Verify this inquiry belongs to this user
    if (profile.kyc_inquiry_id !== inquiryId) {
      console.warn('[personaPoll] Inquiry mismatch:', {
        requested: inquiryId,
        stored: profile.kyc_inquiry_id
      });
    }

    // Call Persona API to check inquiry status
    const personaApiKey = Deno.env.get('PERSONA_API_KEY');
    if (!personaApiKey) {
      console.error('[personaPoll] PERSONA_API_KEY not set');
      return Response.json({ 
        error: 'Server configuration error',
        kyc_status: profile.kyc_status 
      }, { status: 500, headers });
    }

    try {
      const personaResponse = await fetch(`https://withpersona.com/api/v1/inquiries/${inquiryId}`, {
        headers: {
          'Authorization': `Bearer ${personaApiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!personaResponse.ok) {
        console.error('[personaPoll] Persona API error:', personaResponse.status);
        // Return current status from DB
        return Response.json({
          kyc_status: profile.kyc_status,
          inquiry_id: inquiryId,
          source: 'database'
        }, { status: 200, headers });
      }

      const personaData = await personaResponse.json();
      const inquiry = personaData.data;
      const inquiryStatus = inquiry.attributes?.status;

      console.log('[personaPoll] Persona status:', inquiryStatus);

      // Map Persona status to our kyc_status
      let newKycStatus = profile.kyc_status;

      switch (inquiryStatus) {
        case 'completed':
        case 'approved':
          newKycStatus = 'approved';
          break;
        case 'pending':
        case 'created':
          newKycStatus = 'pending';
          break;
        case 'failed':
        case 'declined':
          newKycStatus = 'failed';
          break;
        case 'needs_review':
        case 'reviewing':
          newKycStatus = 'needs_review';
          break;
        default:
          console.log('[personaPoll] Unknown status:', inquiryStatus);
      }

      // Update profile if status changed
      if (newKycStatus !== profile.kyc_status) {
        console.log('[personaPoll] Updating status:', profile.kyc_status, '->', newKycStatus);
        
        await base44.asServiceRole.entities.Profile.update(profile.id, {
          kyc_status: newKycStatus,
          kyc_last_checked: new Date().toISOString()
        });
      }

      return Response.json({
        kyc_status: newKycStatus,
        inquiry_id: inquiryId,
        inquiry_status: inquiryStatus,
        source: 'persona_api'
      }, { status: 200, headers });

    } catch (personaError) {
      console.error('[personaPoll] Persona API call failed:', personaError);
      
      // Return current status from DB as fallback
      return Response.json({
        kyc_status: profile.kyc_status,
        inquiry_id: inquiryId,
        source: 'database',
        error: 'Could not reach Persona API'
      }, { status: 200, headers });
    }

  } catch (error) {
    console.error('[personaPoll] Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500, headers });
  }
});