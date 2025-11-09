import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * NDA Accept - Mark user profile as having accepted NDA
 * Returns success with profile data for immediate client-side state update
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
      console.error('[ndaAccept] No authenticated user');
      return Response.json({
        ok: false,
        error: "You must be logged in to accept the NDA"
      }, { status: 401, headers });
    }

    console.log('[ndaAccept] User:', user.email);

    // Extract IP address
    const getHeader = (key) => req.headers.get(key) || '';
    
    const xForwardedFor = getHeader('x-forwarded-for');
    const ip = (xForwardedFor && xForwardedFor.split(',')[0].trim()) || 
               getHeader('cf-connecting-ip') || 
               getHeader('x-real-ip') || 
               'unknown';

    console.log('[ndaAccept] IP:', ip);

    // Get user's profile using service role for guaranteed access
    const profiles = await base44.asServiceRole.entities.Profile.filter({ 
      user_id: user.id 
    });

    if (profiles.length === 0) {
      console.error('[ndaAccept] No profile found for user:', user.id);
      return Response.json({
        ok: false,
        error: "Profile not found. Please complete onboarding first."
      }, { status: 404, headers });
    }

    const profile = profiles[0];
    console.log('[ndaAccept] Found profile:', profile.id);

    // Check if already accepted
    if (profile.nda_accepted) {
      console.log('[ndaAccept] NDA already accepted');
      return Response.json({
        ok: true,
        ndaAccepted: true,
        profileId: profile.id,
        ndaVersion: profile.nda_version || "v1.0",
        message: "NDA already accepted"
      }, { status: 200, headers });
    }

    // Update profile with NDA acceptance
    const now = new Date().toISOString();
    const updates = {
      nda_accepted: true,
      nda_accepted_at: now,
      nda_version: "v1.0",
      nda_ip: ip
    };

    console.log('[ndaAccept] Updating profile with:', updates);

    await base44.asServiceRole.entities.Profile.update(profile.id, updates);

    console.log('[ndaAccept] ✅ NDA accepted by:', user.email);

    // Create audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id,
        actor_name: profile.full_name || user.email,
        entity_type: 'Profile',
        entity_id: profile.id,
        action: 'nda_accepted',
        details: `NDA v1.0 accepted from IP ${ip}`,
        timestamp: now
      });
    } catch (auditErr) {
      console.warn('[ndaAccept] Failed to log audit:', auditErr);
    }

    return Response.json({
      ok: true,
      ndaAccepted: true,
      profileId: profile.id,
      ndaVersion: "v1.0",
      acceptedAt: now
    }, { status: 200, headers });

  } catch (error) {
    console.error('[ndaAccept] Error:', error);
    return Response.json({
      ok: false,
      error: error.message || "Failed to accept NDA. Please try again."
    }, { status: 500, headers });
  }
});