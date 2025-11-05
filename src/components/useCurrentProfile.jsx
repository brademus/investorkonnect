import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useCurrentProfile - Single source of truth for auth + profile state
 * 
 * Returns:
 * - loading: boolean - true while fetching initial data
 * - user: object | null - Base44 auth user (id, email, role)
 * - profile: object | null - Profile from database
 * - role: 'investor' | 'agent' | 'member' | null - derived from profile
 * - onboarded: boolean - true if onboarding_completed_at is set
 * - hasNDA: boolean - true if NDA has been accepted
 * - kycStatus: string - current KYC status
 * - refresh: function - manually refetch profile data
 * - error: string | null - error message if fetch failed
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
  const retryCount = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    mounted.current = true;
    refresh();
    
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = async () => {
    if (mounted.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      // FIRST: Check Base44 auth directly (faster, more reliable)
      let isAuth = false;
      try {
        isAuth = await base44.auth.isAuthenticated();
        console.log('[useCurrentProfile] Base44 auth check:', isAuth);
      } catch (authCheckError) {
        console.warn('[useCurrentProfile] Base44 auth check failed:', authCheckError.message);
      }

      // If not authenticated at Base44 level, return immediately
      if (!isAuth) {
        console.log('[useCurrentProfile] Not authenticated at Base44 level');
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
        retryCount.current = 0; // Reset retry count
        return;
      }

      // SECOND: Get user details and profile from /functions/me
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
        // Session might still be establishing - retry if under limit
        if (retryCount.current < maxRetries && isAuth) {
          retryCount.current++;
          console.log(`[useCurrentProfile] Profile load failed, retrying (${retryCount.current}/${maxRetries})...`);
          
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount.current));
          
          if (mounted.current) {
            return refresh(); // Recursive retry
          }
          return;
        }
        
        // Max retries reached
        console.error('[useCurrentProfile] Profile load failed after', maxRetries, 'retries');
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            error: 'Failed to load profile'
          });
        }
        retryCount.current = 0;
        return;
      }

      const data = await response.json();
      console.log('[useCurrentProfile] Profile data loaded:', {
        authenticated: data.authenticated,
        onboarded: data.onboarding?.completed,
        role: data.profile?.user_type || data.profile?.user_role
      });

      // Handle unauthenticated state from /functions/me
      if (!data.authenticated || !data.signedIn) {
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
        retryCount.current = 0;
        return;
      }

      // Extract data
      const profile = data.profile || null;
      const onboarded = !!(data.onboarding?.completed || profile?.onboarding_completed_at);
      const role = profile?.user_role || profile?.user_type || null;
      const hasNDA = profile?.nda_accepted || false;
      const kycStatus = profile?.kyc_status || 'unverified';

      // Build user object from available data
      const user = data.email ? {
        id: profile?.user_id || null,
        email: data.email,
        role: profile?.role || 'member'
      } : null;

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

      // Reset retry count on success
      retryCount.current = 0;

    } catch (error) {
      console.error('[useCurrentProfile] Error:', error);
      
      // Retry on network errors if under limit
      if (retryCount.current < maxRetries && error.message?.includes('fetch')) {
        retryCount.current++;
        console.log(`[useCurrentProfile] Network error, retrying (${retryCount.current}/${maxRetries})...`);
        
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount.current));
        
        if (mounted.current) {
          return refresh();
        }
        return;
      }
      
      // Max retries or non-network error
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
      retryCount.current = 0;
    }
  };

  return {
    ...state,
    refresh
  };
}

export default useCurrentProfile;