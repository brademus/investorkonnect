import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile
    const profiles = await base44.entities.Profile.filter({ user_id: user.id });
    const profile = profiles[0];
    
    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Return identity status from profile
    const identity = {
      verificationStatus: profile.identity_status === 'approved' || profile.identity_status === 'verified' 
        ? 'VERIFIED' 
        : profile.identity_status === 'pending' 
        ? 'PROCESSING' 
        : 'NOT_STARTED',
      verified_at: profile.identity_verified_at,
      session_id: profile.identity_session_id,
      provider: profile.identity_provider || 'stripe_identity'
    };

    return Response.json({ identity });
  } catch (error) {
    console.error('[getIdentityStatus] Error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get identity status' 
    }, { status: 500 });
  }
});