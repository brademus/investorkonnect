import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * CANONICAL PROFILE HOOK
 * 
 * Single source of truth for current user + profile state.
 * Uses existing backend functions, no new APIs.
 * 
 * Returns:
 * - loading: boolean
 * - user: Base44 auth user object
 * - profile: Profile entity (canonical, 1:1 with user)
 * - role: 'investor' | 'agent' | 'admin' | 'member'
 * - onboarded: boolean (true if completed onboarding)
 * - hasNDA: boolean (NDA accepted status)
 * - kycStatus: 'unverified' | 'pending' | 'approved' | 'needs_review' | 'failed'
 * - kycVerified: boolean (shortcut for kycStatus === 'approved')
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
            error: null
          });
          return;
        }

        // STEP 2: Get/ensure canonical profile
        // Use existing /functions/me or call ensureProfile flow
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
        // Investor: must have name, phone, and onboarding_completed_at OR have entered intake data
        // Agent: must have name, license, markets, and onboarding_completed_at
        let onboarded = false;
        
        if (profile?.onboarding_completed_at) {
          // Explicit flag set
          onboarded = true;
        } else if (profile) {
          // Infer from data completeness
          const hasBasicInfo = !!(profile.full_name && profile.phone);
          
          if (role === 'investor') {
            // Investor is onboarded if they have basic info
            // (Detailed intake can happen after pricing)
            onboarded = hasBasicInfo;
          } else if (role === 'agent') {
            // Agent needs more: license, markets, specialties
            const hasLicense = !!(profile.licenseNumber && profile.licenseState);
            const hasMarkets = profile.markets && profile.markets.length > 0;
            const hasSpecialties = profile.agent?.specialties && profile.agent.specialties.length > 0;
            
            onboarded = hasBasicInfo && hasLicense && hasMarkets && hasSpecialties;
          }
        }

        // STEP 5: NDA status
        const hasNDA = profile?.nda_accepted || false;

        // STEP 6: KYC status
        const kycStatus = profile?.kyc_status || 'unverified';
        const kycVerified = kycStatus === 'approved';

        setState({
          loading: false,
          user,
          profile,
          role,
          onboarded,
          hasNDA,
          kycStatus,
          kycVerified,
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