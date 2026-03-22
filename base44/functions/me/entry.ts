import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { ensureProfile } from './ensureProfile.js';

Deno.serve(async (req) => {
  // CRITICAL: NO CACHE - always fresh
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  try {
    console.log('[/functions/me] === Request received ===');
    
    const base44 = createClientFromRequest(req);
    
    // Try to get authenticated user
    let user = null;
    let authError = null;
    
    try {
      user = await base44.auth.me();
      console.log('[/functions/me] Auth check:', user ? `✅ ${user.email}` : '❌ No user');
    } catch (error) {
      authError = error;
      console.log('[/functions/me] Not authenticated:', error.message);
    }

    // NOT AUTHENTICATED - return immediately
    if (!user || !user.email || authError) {
      console.log('[/functions/me] Returning unauthenticated state');
      return Response.json({
        signedIn: false,
        authenticated: false,
        onboarding: { completed: false, completedAt: null },
        flags: { needsOnboarding: true, hasActiveSub: false, role: null, plan: null }
      }, { status: 200, headers });
    }

    console.log('[/functions/me] User authenticated, loading profile...');

    // User is authenticated - ensure profile exists
    let profile;
    try {
      profile = await ensureProfile(base44, user);
      console.log('[/functions/me] Profile loaded:', profile?.id);
    } catch (ensureError) {
      console.error('[/functions/me] Failed to ensure profile:', ensureError);
      // Return authenticated but without profile
      return Response.json({
        signedIn: true,
        authenticated: true,
        email: user.email,
        onboarding: { completed: false, completedAt: null },
        flags: { needsOnboarding: true, hasActiveSub: false, role: null, plan: null },
        error: 'profile_load_failed'
      }, { status: 200, headers });
    }

    // Check onboarding completion
    const onboardingCompleted = !!(profile.onboarding_completed_at);
    console.log('[/functions/me] Onboarding completed:', onboardingCompleted);

    // Check subscription status
    const subStatus = profile.subscription_status || 'none';
    const hasActiveSub = subStatus === 'active' || subStatus === 'trialing';

    // Build response
    const response = {
      signedIn: true,
      authenticated: true,
      email: user.email,
      onboarding: {
        completed: onboardingCompleted,
        completedAt: profile.onboarding_completed_at || null
      },
      subscription: {
        status: subStatus,
        plan: profile.subscription_tier || null,
        tier: profile.subscription_tier || null
      },
      flags: {
        needsOnboarding: !onboardingCompleted,
        hasActiveSub: hasActiveSub,
        role: profile.user_type || profile.role || null,
        plan: profile.subscription_tier || null
      },
      profile: profile
    };

    console.log('[/functions/me] ✅ Returning profile data');
    return Response.json(response, { status: 200, headers });

  } catch (error) {
    console.error('[/functions/me] ❌ Unexpected error:', error);
    return Response.json({
      signedIn: false,
      authenticated: false,
      onboarding: { completed: false, completedAt: null },
      flags: { needsOnboarding: true, hasActiveSub: false, role: null, plan: null },
      error: error.message
    }, { status: 200, headers });
  }
});