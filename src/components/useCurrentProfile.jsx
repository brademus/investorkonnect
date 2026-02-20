import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import * as Sentry from '@sentry/react';

// Global cache to prevent redundant API calls across component instances
let globalProfileCache = null;
let globalCacheTimestamp = 0;
const CACHE_DURATION = 10000; // 10 seconds

/**
 * CANONICAL PROFILE HOOK - Enhanced with Aggressive Caching to Prevent Rate Limits
 * 
 * Single source of truth for current user + profile + onboarding + KYC + NDA state.
 */
export function useCurrentProfile() {
  const [state, setState] = useState({
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
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const loadingRef = useRef(false);

  // Safety reset: if a previous mount left loadingRef stuck, clear it on fresh mount
  useEffect(() => {
    loadingRef.current = false;
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const loadProfile = async () => {
      // Prevent concurrent calls
      if (loadingRef.current) {
        console.log('[useCurrentProfile] Already loading, skipping...');
        return;
      }

      // Use global cache if recent enough
      const now = Date.now();
      if (globalProfileCache && (now - globalCacheTimestamp) < CACHE_DURATION) {
        console.log('[useCurrentProfile] Using cached profile');
        if (mounted) setState(globalProfileCache);
        return;
      }

      loadingRef.current = true;

      try {
        // Small stagger to avoid competing with navigation logging
        await new Promise(r => setTimeout(r, 150));
        if (!mounted) return;

        const user = await base44.auth.me();
        if (!mounted) return;
        
        if (!user) {
          setState({
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
          });
          return;
        }

        console.log('[useCurrentProfile] Loading profile for user:', user.id, user.email);

        // Load profile by user_id (fastest path) - with rate limit protection
        let profile = null;
        try {
          let profiles = await base44.entities.Profile.filter({ user_id: user.id });
          profile = profiles[0] || null;
          console.log('[useCurrentProfile] Profile by user_id:', profile ? profile.id : 'not found');
        } catch (e) {
          console.warn('[useCurrentProfile] Filter by user_id failed:', e.message);
        }

        // Fallback: search by email only if user_id search failed
        if (!profile) {
          try {
            const emailLower = user.email.toLowerCase().trim();
            const profiles = await base44.entities.Profile.filter({ email: emailLower });
            profile = profiles[0] || null;
            console.log('[useCurrentProfile] Profile by email:', profile ? profile.id : 'not found');
            if (profile && profile.user_id !== user.id) {
              try {
                await base44.entities.Profile.update(profile.id, { user_id: user.id });
                profile.user_id = user.id;
                console.log('[useCurrentProfile] Updated profile user_id');
              } catch (e) {
                console.error('[useCurrentProfile] Failed to update user_id:', e);
              }
            }
          } catch (e) {
            console.error('[useCurrentProfile] Email lookup failed:', e.message);
          }
        }

        if (!profile) {
          console.error('[useCurrentProfile] No profile found for user:', user.id, user.email);
        }

        if (!mounted) return;

        // 1. Role
        let role = profile?.user_role || profile?.user_type || (profile?.onboarding_version?.startsWith('agent') ? 'agent' : (profile?.onboarding_version ? 'investor' : null)) || user.role || 'member';
        const isAdmin = user.role === 'admin' || profile?.role === 'admin';
        if (isAdmin) role = 'admin';
        else if (role !== 'investor' && role !== 'agent') role = 'member';

        // 2. Onboarding
        const hasLegacyProfile = !!(profile?.full_name && profile?.phone && (profile?.company || profile?.investor?.company_name));
        const onboarded = !!(profile?.onboarding_completed_at || profile?.onboarding_step === 'basic_complete' || profile?.onboarding_step === 'deep_complete' || profile?.onboarding_version || hasLegacyProfile);
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

        console.log('[useCurrentProfile] Setting state:', {
          profileId: profile?.id,
          fullName: profile?.full_name,
          role,
          onboarded,
          kycVerified,
          hasNDA
        });

        // Update global cache
        globalProfileCache = finalState;
        globalCacheTimestamp = Date.now();

        if (mounted) setState(finalState);

      } catch (error) {
        console.error('[useCurrentProfile] Fatal error:', error);
              const isAuthError = error?.message?.includes('Authentication required') || error?.message?.includes('401') || error?.message?.includes('Unauthorized');
              if (!isAuthError) {
                Sentry.captureException(error, { tags: { source: 'useCurrentProfile' } });
              }
        
        // On rate limit, use stale cache if available
        if (error?.message?.includes('Rate limit') && globalProfileCache) {
          console.log('[useCurrentProfile] Rate limited - using stale cache');
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
      } finally {
        loadingRef.current = false;
      }
    };

    loadProfile();
    return () => { mounted = false; };
  }, [refreshTrigger]);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  return { ...state, refresh };
}

export default useCurrentProfile;