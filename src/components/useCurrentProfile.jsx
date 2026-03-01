import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';


// Global cache to prevent redundant API calls across component instances
let globalProfileCache = null;
let globalCacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds — generous to survive Safari refresh

// Persist cache to sessionStorage so Safari hard-refreshes start warm
const SESSION_KEY = '__ik_profile_cache';
function persistCache(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ state, ts: Date.now() }));
  } catch (_) {}
}
function loadPersistedCache() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { state, ts } = JSON.parse(raw);
    if (state && ts && (Date.now() - ts) < 120000) return { state, ts }; // 2 min TTL for persisted
  } catch (_) {}
  return null;
}

// On module init, hydrate in-memory cache from sessionStorage
if (!globalProfileCache) {
  const persisted = loadPersistedCache();
  if (persisted) {
    globalProfileCache = persisted.state;
    globalCacheTimestamp = persisted.ts;
  }
}

// Safari BFCache: on restore, trigger a background refresh but keep stale cache
// so the UI doesn't flash loading state
if (typeof window !== 'undefined' && !window.__PROFILE_BFCACHE_LISTENER__) {
  window.__PROFILE_BFCACHE_LISTENER__ = true;
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      // Mark cache as stale so next useEffect re-fetches, but DON'T null it out
      globalCacheTimestamp = 0;
    }
  });
}

/**
 * CANONICAL PROFILE HOOK - Enhanced with Aggressive Caching to Prevent Rate Limits
 * 
 * Single source of truth for current user + profile + onboarding + KYC + NDA state.
 */
export function useCurrentProfile() {
  const [state, setState] = useState(() => {
    // Initialize from in-memory or sessionStorage cache to avoid loading flash on Safari refresh
    if (globalProfileCache && globalProfileCache.user) {
      return globalProfileCache;
    }
    return {
      loading: true,
      user: null,
      profile: null,
      role: null,
      onboarded: false,
      needsOnboarding: false,
      kycStatus: 'unverified',
      kycVerified: false,
      needsKyc: false,
      hasNDA: false,
      needsNda: false,
      isInvestorReady: false,
      hasRoom: false,
      targetState: null,
      subscriptionPlan: 'none',
      subscriptionStatus: 'none',
      isPaidSubscriber: false,
      error: null
    };
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    
    const loadProfile = async () => {
      // Use global cache if recent enough
      const now = Date.now();
      if (globalProfileCache && (now - globalCacheTimestamp) < CACHE_DURATION) {
        if (mounted) setState(globalProfileCache);
        return;
      }

      try {
        const user = await base44.auth.me();
        if (!mounted) return;
        
        if (!user) {
          const noUserState = {
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            needsOnboarding: false,
            kycStatus: 'unverified',
            kycVerified: false,
            needsKyc: false,
            hasNDA: false,
            needsNda: false,
            isInvestorReady: false,
            hasRoom: false,
            targetState: null,
            subscriptionPlan: 'none',
            subscriptionStatus: 'none',
            isPaidSubscriber: false,
            error: null
          };
          globalProfileCache = noUserState;
          globalCacheTimestamp = Date.now();
          if (mounted) setState(noUserState);
          return;
        }

        // Load profile by user_id (fastest path) - with rate limit protection
        let profile = null;
        try {
          let profiles = await base44.entities.Profile.filter({ user_id: user.id });
          profile = profiles[0] || null;
        } catch (e) {
          console.warn('[useCurrentProfile] Filter by user_id failed:', e.message);
        }

        // Fallback: search by email only if user_id search failed
        if (!profile) {
          try {
            const emailLower = user.email.toLowerCase().trim();
            const profiles = await base44.entities.Profile.filter({ email: emailLower });
            profile = profiles[0] || null;
            if (profile && profile.user_id !== user.id) {
              try {
                await base44.entities.Profile.update(profile.id, { user_id: user.id });
                profile.user_id = user.id;
              } catch (e) {
                console.error('[useCurrentProfile] Failed to update user_id:', e);
              }
            }
          } catch (e) {
            console.error('[useCurrentProfile] Email lookup failed:', e.message);
          }
        }

        // No profile found is OK — user may still be in onboarding

        if (!mounted) return;

        // 1. Role
        let role = profile?.user_role || profile?.user_type || (profile?.onboarding_version?.startsWith('agent') ? 'agent' : (profile?.onboarding_version ? 'investor' : null)) || user.role || 'member';
        const isAdmin = user.role === 'admin' || profile?.role === 'admin';
        if (isAdmin) role = 'admin';
        else if (role !== 'investor' && role !== 'agent') role = 'member';

        // 2. Onboarding — admins always considered onboarded
        const hasLegacyProfile = !!(profile?.full_name && profile?.phone && (profile?.company || profile?.investor?.company_name));
        const onboarded = isAdmin || !!(profile?.onboarding_completed_at || profile?.onboarding_step === 'basic_complete' || profile?.onboarding_step === 'deep_complete' || profile?.onboarding_version || hasLegacyProfile);
        const needsOnboarding = !isAdmin && (role === 'investor' || role === 'agent') && !onboarded;

        // 3. Subscription (Investors only)
        const subscriptionStatus = profile?.subscription_status || 'none';
        const isPaidSubscriber = isAdmin || subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
        const needsSubscription = !isAdmin && role === 'investor' && onboarded && !isPaidSubscriber;

        // 4. KYC / Identity Verification
        // Placeholder for production: verify profile.full_name matches Stripe verified name
        const kycStatus = isAdmin ? 'approved' : (profile?.kyc_status || profile?.identity_status || 'unverified');
        const kycVerified = isAdmin || kycStatus === 'approved' || kycStatus === 'verified' || !!profile?.identity_verified || !!profile?.identity_verified_at;
        const needsKyc = !isAdmin && onboarded && (role === 'agent' || isPaidSubscriber) && !kycVerified;

        // 5. NDA
        const hasNDA = isAdmin || !!profile?.nda_accepted;
        const needsNda = !isAdmin && onboarded && kycVerified && !hasNDA;

        // 6. Readiness
        const isInvestorReady = isAdmin || (role === 'investor' && onboarded && isPaidSubscriber && kycVerified && hasNDA);

        const targetState = profile?.target_state || profile?.markets?.[0] || null;
        // Skip expensive hasRoom check on initial load for faster performance
        const hasRoom = false;

        const finalState = {
          loading: false,
          user,
          profile,
          role,
          onboarded,
          needsOnboarding,
          kycStatus,
          kycVerified,
          needsKyc,
          hasNDA,
          needsNda,
          isInvestorReady,
          hasRoom,
          targetState,
          subscriptionPlan: profile?.subscription_tier || 'none',
          subscriptionStatus,
          isPaidSubscriber,
          needsSubscription,
          error: null
        };

        // Update global cache + persist to sessionStorage for Safari refresh
        globalProfileCache = finalState;
        globalCacheTimestamp = Date.now();
        persistCache(finalState);

        if (mounted) setState(finalState);

      } catch (error) {
        console.error('[useCurrentProfile] Fatal error:', error);
        const isAuthError = error?.message?.includes('Authentication required') || error?.message?.includes('401') || error?.message?.includes('Unauthorized');
        if (!isAuthError) {
          console.error('[useCurrentProfile] Error captured:', error);
        }
        
        // On rate limit or error, use stale cache if available
        if (globalProfileCache) {
          if (mounted) setState(globalProfileCache);
          return;
        }

        if (!mounted) return;
        
        const errorState = {
          loading: false,
          user: null,
          profile: null,
          role: null,
          onboarded: false,
          needsOnboarding: false,
          kycStatus: 'unverified',
          kycVerified: false,
          needsKyc: false,
          hasNDA: false,
          needsNda: false,
          isInvestorReady: false,
          hasRoom: false,
          targetState: null,
          subscriptionPlan: 'none',
          subscriptionStatus: 'none',
          isPaidSubscriber: false,
          error: error.message || 'Profile load failed'
        };

        setState(errorState);
      }
    };

    loadProfile();
    return () => { mounted = false; };
  }, [refreshTrigger]);

  const refresh = () => {
    // Bust all caches so the next fetch gets fresh data
    globalProfileCache = null;
    globalCacheTimestamp = 0;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    setRefreshTrigger(prev => prev + 1);
  };

  return { ...state, refresh };
}

export default useCurrentProfile;