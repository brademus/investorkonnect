import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * CANONICAL PROFILE HOOK - Enhanced with Clear KYC Gating
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

  useEffect(() => {
    let mounted = true;
    
    const loadProfile = async () => {
      try {
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

        // Load profile by user_id (fastest path)
        let profiles = await base44.entities.Profile.filter({ user_id: user.id });
        let profile = profiles[0] || null;
        
        // Fallback: search by email
        if (!profile) {
          const emailLower = user.email.toLowerCase().trim();
          profiles = await base44.entities.Profile.filter({ email: emailLower });
          profile = profiles[0] || null;
          if (profile && profile.user_id !== user.id) {
            try {
              await base44.entities.Profile.update(profile.id, { user_id: user.id });
              profile.user_id = user.id;
            } catch (e) {}
          }
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

        setState({
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
        });

      } catch (error) {
        console.error('[useCurrentProfile] Fatal error:', error);
        if (!mounted) return;
        setState(prev => ({ ...prev, loading: false, error: error.message }));
      }
    };

    loadProfile();
    return () => { mounted = false; };
  }, [refreshTrigger]);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  return { ...state, refresh };
}

export default useCurrentProfile;