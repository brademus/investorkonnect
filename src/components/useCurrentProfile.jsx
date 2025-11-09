import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * CANONICAL PROFILE HOOK - Enhanced for Wizard Flow
 * 
 * Single source of truth for current user + profile state.
 * Now includes hasRoom check for navigation logic.
 * 
 * IMPORTANT: A user is considered "onboarded" ONLY if:
 * - onboarding_completed_at is set AND
 * - user_role is set (from NEW onboarding)
 * This forces anyone with only OLD onboarding data to complete NEW onboarding.
 * 
 * Returns:
 * - loading: boolean
 * - user: Base44 auth user object
 * - profile: Profile entity (canonical, 1:1 with user)
 * - role: 'investor' | 'agent' | 'admin' | 'member'
 * - onboarded: boolean (true if completed NEW onboarding)
 * - hasNDA: boolean (NDA accepted status)
 * - kycStatus: 'unverified' | 'pending' | 'approved' | 'needs_review' | 'failed'
 * - kycVerified: boolean (shortcut for kycStatus === 'approved')
 * - isInvestorReady: boolean (investor fully ready for subscriptions/trials)
 * - hasRoom: boolean (has at least one room)
 * - targetState: string (user's selected market/state)
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
        // Priority: profile.user_role > profile.user_type > user.role
        let role = profile?.user_role || profile?.user_type || user.role || 'member';
        
        // Normalize role
        if (role === 'investor' || role === 'agent') {
          // Keep as is
        } else if (user.role === 'admin') {
          role = 'admin';
        } else {
          role = 'member';
        }

        // STEP 4: Determine onboarded status
        // NEW LOGIC: Onboarding is complete ONLY if:
        // 1) onboarding_completed_at exists AND
        // 2) user_role is set (NEW onboarding finished)
        // This forces anyone with only OLD onboarding data (timestamp but no user_role) to complete NEW onboarding.
        let onboarded = false;
        
        if (profile?.onboarding_completed_at && profile?.user_role) {
          // Both timestamp AND role are set → NEW onboarding complete
          onboarded = true;
        }
        // If only timestamp exists but no user_role → OLD onboarding only → NOT considered onboarded

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
          // Default to false
        }

        // STEP 9: Determine if investor is fully ready for subscriptions/trials
        // An investor is ready ONLY when ALL of these are true:
        // - role is investor
        // - NEW onboarding complete
        // - NDA accepted
        // - KYC verified
        const isInvestorReady = 
          role === 'investor' &&
          onboarded &&
          hasNDA &&
          kycVerified;

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