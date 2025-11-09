import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * CANONICAL PROFILE HOOK - Enhanced with v2 Onboarding Check
 * 
 * Single source of truth for current user + profile + onboarding + subscription state.
 * 
 * Returns:
 * - loading: boolean
 * - user: Base44 auth user object
 * - profile: Profile entity (canonical, 1:1 with user)
 * - role: 'investor' | 'agent' | 'admin' | 'member'
 * - onboarded: boolean (true if completed NEW v2/v2-agent onboarding)
 * - hasNDA: boolean (NDA accepted status)
 * - kycStatus: 'unverified' | 'pending' | 'approved' | 'needs_review' | 'failed'
 * - kycVerified: boolean (shortcut for kycStatus === 'approved')
 * - isInvestorReady: boolean (investor fully ready for subscriptions/trials)
 * - hasRoom: boolean (has at least one room)
 * - targetState: string (user's selected market/state)
 * - subscriptionPlan: 'starter' | 'pro' | 'enterprise' | 'none'
 * - subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none'
 * - isPaidSubscriber: boolean (active or trialing subscription)
 * - error: string | null
 * - refresh: function to reload profile data
 */
export function useCurrentProfile() {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null,
    role: null,
    onboarded: false,
    hasNDA: false,
    kycStatus: 'unverified',
    kycVerified: false,
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
        // STEP 1: Get authenticated user via Base44 auth
        const user = await base44.auth.me();
        
        if (!mounted) return;
        
        if (!user) {
          // Not authenticated
          setState({
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            kycVerified: false,
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

        // STEP 2: Get/ensure canonical profile
        let profile = null;
        
        try {
          // Try fetching via /functions/me if it exists
          const meResponse = await fetch('/functions/me', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (meResponse.ok) {
            const meData = await meResponse.json();
            profile = meData.profile;
          }
        } catch (fetchErr) {
          console.log('[useCurrentProfile] /functions/me not available, querying Profile directly');
        }
        
        // Fallback: query Profile entity directly
        if (!profile) {
          const profiles = await base44.entities.Profile.filter({ 
            user_id: user.id 
          });
          profile = profiles[0] || null;
        }

        if (!mounted) return;

        // STEP 3: Derive role
        let role = profile?.user_role || profile?.user_type || user.role || 'member';
        
        // Normalize role
        if (role === 'investor' || role === 'agent') {
          // Keep as is
        } else if (user.role === 'admin') {
          role = 'admin';
        } else {
          role = 'member';
        }

        // STEP 4: Determine onboarded status (v2 for investor, v2-agent for agent)
        // CRITICAL: Check role-specific onboarding version
        let onboarded = false;
        
        if (role === 'investor') {
          // Investor must have v2 onboarding
          if (
            profile?.onboarding_version === 'v2' &&
            profile?.onboarding_completed_at &&
            profile?.user_role === 'investor'
          ) {
            onboarded = true;
          }
        } else if (role === 'agent') {
          // Agent must have v2-agent onboarding
          if (
            profile?.onboarding_version === 'v2-agent' &&
            profile?.onboarding_completed_at &&
            profile?.user_role === 'agent'
          ) {
            onboarded = true;
          }
        }

        // STEP 5: NDA status
        const hasNDA = profile?.nda_accepted || false;

        // STEP 6: KYC status
        const kycStatus = profile?.kyc_status || 'unverified';
        const kycVerified = kycStatus === 'approved';

        // STEP 7: Target state
        const targetState = profile?.target_state || profile?.markets?.[0] || null;

        // STEP 8: Check if user has any rooms
        let hasRoom = false;
        try {
          const roomsResponse = await base44.functions.invoke('inboxList');
          const rooms = roomsResponse.data || [];
          hasRoom = rooms.length > 0;
        } catch (roomErr) {
          console.warn('[useCurrentProfile] Could not check rooms:', roomErr);
        }

        // STEP 9: Determine if investor is fully ready for subscriptions/trials
        const isInvestorReady = 
          role === 'investor' &&
          onboarded &&
          hasNDA &&
          kycVerified;

        // STEP 10: Extract subscription info
        const subscriptionPlan = profile?.subscription_tier || 'none';
        const subscriptionStatus = profile?.subscription_status || 'none';
        const isPaidSubscriber = 
          subscriptionStatus === 'active' || 
          subscriptionStatus === 'trialing';

        console.log('[useCurrentProfile] 📊 Profile state:', {
          role,
          onboarded,
          onboarding_version: profile?.onboarding_version,
          has_onboarding_completed_at: !!profile?.onboarding_completed_at,
          subscription: subscriptionPlan,
          isPaid: isPaidSubscriber
        });

        setState({
          loading: false,
          user,
          profile,
          role,
          onboarded,
          hasNDA,
          kycStatus,
          kycVerified,
          isInvestorReady,
          hasRoom,
          targetState,
          subscriptionPlan,
          subscriptionStatus,
          isPaidSubscriber,
          error: null
        });

      } catch (error) {
        if (!mounted) return;
        
        console.error('[useCurrentProfile] Error:', error);
        setState({
          loading: false,
          user: null,
          profile: null,
          role: null,
          onboarded: false,
          hasNDA: false,
          kycStatus: 'unverified',
          kycVerified: false,
          isInvestorReady: false,
          hasRoom: false,
          targetState: null,
          subscriptionPlan: 'none',
          subscriptionStatus: 'none',
          isPaidSubscriber: false,
          error: error.message
        });
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  // Refresh function to manually reload profile
  const refresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return { ...state, refresh };
}

export default useCurrentProfile;