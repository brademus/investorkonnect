import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { inboxList } from '@/components/functions';
import { DEMO_MODE } from '@/components/config/demo';

/**
 * CANONICAL PROFILE HOOK - Enhanced with Clear KYC Gating
 * 
 * Single source of truth for current user + profile + onboarding + KYC + NDA state.
 * 
 * CRITICAL: Separate flags for each step:
 * - needsOnboarding: onboarding not complete
 * - needsKyc: onboarding done, but Persona/KYC not done
 * - needsNda: onboarding + KYC done, but NDA not accepted
 * 
 * Returns:
 * - loading: boolean
 * - user: Base44 auth user object
 * - profile: Profile entity (canonical, 1:1 with user)
 * - role: 'investor' | 'agent' | 'admin' | 'member'
 * - onboarded: boolean (true if completed NEW v2/agent-v2-deep onboarding)
 * - needsOnboarding: boolean (true if onboarding incomplete)
 * - kycStatus: 'unverified' | 'pending' | 'approved' | 'needs_review' | 'failed'
 * - kycVerified: boolean (shortcut for kycStatus === 'approved')
 * - needsKyc: boolean (onboarding done but KYC not verified)
 * - hasNDA: boolean (NDA accepted status)
 * - needsNda: boolean (onboarding + KYC done but NDA not accepted)
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
        // DEMO MODE: Load from sessionStorage
        if (DEMO_MODE) {
          const demoUser = JSON.parse(sessionStorage.getItem('demo_user') || 'null');
          const demoProfile = JSON.parse(sessionStorage.getItem('demo_profile') || 'null');
          
          if (demoUser && demoProfile) {
            const role = demoProfile.user_role || 'member';
            const onboarded = !!demoProfile.onboarding_completed_at;
            const kycStatus = demoProfile.kyc_status || 'unverified';
            const kycVerified = kycStatus === 'approved' || demoProfile.identity_verified;
            const hasNDA = demoProfile.nda_accepted || false;
            const targetState = demoProfile.target_state || demoProfile.markets?.[0] || null;
            
            // Check for demo rooms
            let hasRoom = false;
            try {
              const sessionRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
              hasRoom = sessionRooms.length > 0;
            } catch (e) {}
            
            setState({
              loading: false,
              user: demoUser,
              profile: demoProfile,
              role,
              onboarded,
              needsOnboarding: !onboarded && (role === 'investor' || role === 'agent'),
              kycStatus,
              kycVerified,
              needsKyc: onboarded && !kycVerified,
              hasNDA,
              needsNda: onboarded && kycVerified && !hasNDA,
              isInvestorReady: role === 'investor' && onboarded && kycVerified && hasNDA,
              hasRoom,
              targetState,
              subscriptionPlan: demoProfile.subscription_tier || 'none',
              subscriptionStatus: demoProfile.subscription_status || 'none',
              isPaidSubscriber: false,
              error: null
            });
            return;
          }
        }
        
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
          // Silent fallback - no logging for regular users
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
        
        // ADMIN BYPASS: Check if user is admin (from user.role or profile.role)
        const isAdmin = user.role === 'admin' || profile?.role === 'admin';
        
        // Normalize role
        if (isAdmin) {
          role = 'admin';
        } else if (role === 'investor' || role === 'agent') {
          // Keep as is
        } else {
          role = 'member';
        }

        // STEP 4: Determine onboarded status (v2 for investor, agent-v2-deep for agent)
        let onboarded = false;
        
        if (role === 'investor') {
          // Investor must have v2 onboarding
          onboarded = 
            profile?.onboarding_version === 'v2' &&
            !!profile?.onboarding_completed_at &&
            profile?.user_role === 'investor';
        } else if (role === 'agent') {
          // Agent must have EXACTLY "agent-v2-deep" onboarding
          onboarded = 
            profile?.onboarding_version === 'agent-v2-deep' &&
            !!profile?.onboarding_completed_at &&
            profile?.user_role === 'agent';
        }

        // needsOnboarding = user has a role but hasn't completed onboarding (EXCEPT admins)
        const needsOnboarding = !isAdmin && (role === 'investor' || role === 'agent') && !onboarded;

        // STEP 5: KYC status (admins auto-approved)
        const kycStatus = isAdmin ? 'approved' : (profile?.kyc_status || 'unverified');
        const kycVerified = isAdmin || kycStatus === 'approved';
        
        // needsKyc = onboarding complete but KYC not verified (EXCEPT admins)
        const needsKyc = !isAdmin && onboarded && !kycVerified;

        // STEP 6: NDA status (admins auto-accepted)
        const hasNDA = isAdmin || profile?.nda_accepted || false;
        
        // needsNda = onboarding + KYC complete but NDA not accepted (EXCEPT admins)
        const needsNda = !isAdmin && onboarded && kycVerified && !hasNDA;

        // STEP 7: Target state
        const targetState = profile?.target_state || profile?.markets?.[0] || null;

        // STEP 8: Check if user has any rooms
        let hasRoom = false;
        try {
          const roomsResponse = await inboxList();
          const rooms = roomsResponse.data || [];
          hasRoom = rooms.length > 0;
        } catch (roomErr) {
          console.warn('[useCurrentProfile] Could not check rooms:', roomErr);
        }

        // STEP 9: Determine if investor is fully ready (admins are always ready)
        const isInvestorReady = 
          isAdmin ||
          (role === 'investor' &&
          onboarded &&
          kycVerified &&
          hasNDA);

        // STEP 10: Extract subscription info
        const subscriptionPlan = profile?.subscription_tier || 'none';
        const subscriptionStatus = profile?.subscription_status || 'none';
        const isPaidSubscriber = 
          subscriptionStatus === 'active' || 
          subscriptionStatus === 'trialing';

        // Debug logging only for admin users
        if (isAdmin) {
          console.log('[useCurrentProfile] 📊 Profile state:', {
            role,
            onboarded,
            needsOnboarding,
            kycVerified,
            needsKyc,
            hasNDA,
            needsNda,
            onboarding_version: profile?.onboarding_version,
          });
        }

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
  const refresh = async () => {
    // In demo mode, reload from sessionStorage immediately
    if (DEMO_MODE) {
      const demoProfile = JSON.parse(sessionStorage.getItem('demo_profile') || 'null');
      if (demoProfile) {
        const role = demoProfile.user_role || 'member';
        const onboarded = !!demoProfile.onboarding_completed_at;
        const kycStatus = demoProfile.kyc_status || 'unverified';
        const kycVerified = kycStatus === 'approved' || demoProfile.identity_verified;
        const hasNDA = demoProfile.nda_accepted || false;
        
        setState(prev => ({
          ...prev,
          profile: demoProfile,
          role,
          onboarded,
          needsOnboarding: !onboarded && (role === 'investor' || role === 'agent'),
          kycStatus,
          kycVerified,
          needsKyc: onboarded && !kycVerified,
          hasNDA,
          needsNda: onboarded && kycVerified && !hasNDA,
          isInvestorReady: role === 'investor' && onboarded && kycVerified && hasNDA,
        }));
        return;
      }
    }
    setRefreshTrigger(prev => prev + 1);
  };

  return { ...state, refresh };
}

export default useCurrentProfile;