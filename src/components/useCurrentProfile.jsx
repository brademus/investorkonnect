import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useCurrentProfile - Simplified auth + profile state
 * NO MORE COMPLEX RETRIES - keep it simple and reliable
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
    error: null
  });
  
  const mounted = useRef(true);
  const hasRun = useRef(false);

  useEffect(() => {
    mounted.current = true;
    
    if (!hasRun.current) {
      hasRun.current = true;
      loadProfile();
    }
    
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadProfile = async () => {
    try {
      console.log('[useCurrentProfile] Loading profile...');

      // Single call to /functions/me - no retries, keep it simple
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        console.log('[useCurrentProfile] Not authenticated (response not ok)');
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            error: null
          });
        }
        return;
      }

      const data = await response.json();
      console.log('[useCurrentProfile] Response:', {
        authenticated: data.authenticated,
        hasProfile: !!data.profile,
        onboarded: data.onboarding?.completed
      });

      // Not authenticated
      if (!data.authenticated || !data.signedIn) {
        console.log('[useCurrentProfile] Not authenticated');
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            error: null
          });
        }
        return;
      }

      // Authenticated but no profile yet - might be brand new user
      if (!data.profile) {
        console.log('[useCurrentProfile] Authenticated but no profile');
        if (mounted.current) {
          setState({
            loading: false,
            user: data.email ? { email: data.email, id: null, role: 'member' } : null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            error: null
          });
        }
        return;
      }

      // Success - have auth + profile
      const profile = data.profile;
      const onboarded = !!(data.onboarding?.completed || profile.onboarding_completed_at);
      const role = profile.user_role || profile.user_type || null;
      const hasNDA = profile.nda_accepted || false;
      const kycStatus = profile.kyc_status || 'unverified';

      const user = data.email ? {
        id: profile.user_id || null,
        email: data.email,
        role: profile.role || 'member'
      } : null;

      console.log('[useCurrentProfile] Success!', {
        email: data.email,
        role,
        onboarded
      });

      if (mounted.current) {
        setState({
          loading: false,
          user,
          profile,
          role,
          onboarded,
          hasNDA,
          kycStatus,
          error: null
        });
      }

    } catch (error) {
      console.error('[useCurrentProfile] Error:', error);
      
      if (mounted.current) {
        setState({
          loading: false,
          user: null,
          profile: null,
          role: null,
          onboarded: false,
          hasNDA: false,
          kycStatus: 'unverified',
          error: error.message || 'Failed to load profile'
        });
      }
    }
  };

  const refresh = () => {
    hasRun.current = false;
    loadProfile();
  };

  return {
    ...state,
    refresh
  };
}

export default useCurrentProfile;