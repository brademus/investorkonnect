import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useCurrentProfile - Single source of truth for auth + profile state
 * 
 * HANDLES POST-LOGIN SESSION ESTABLISHMENT WITH AGGRESSIVE RETRIES
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
  const maxRetries = 5; // Increased from 3 to 5 for post-login scenarios

  useEffect(() => {
    mounted.current = true;
    
    // Start loading immediately
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
      console.log('[useCurrentProfile] Starting auth check, attempt:', retryCount.current + 1);

      // Call /functions/me which handles all auth + profile logic
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
        // Server error - retry with exponential backoff
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          const delay = Math.min(1000 * Math.pow(2, retryCount.current - 1), 5000); // Max 5s delay
          console.log(`[useCurrentProfile] Server error, retrying in ${delay}ms (${retryCount.current}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          if (mounted.current) {
            return refresh();
          }
          return;
        }
        
        // Max retries reached
        console.error('[useCurrentProfile] Max retries reached after server errors');
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            error: 'Failed to load profile after multiple attempts'
          });
        }
        retryCount.current = 0;
        return;
      }

      const data = await response.json();
      console.log('[useCurrentProfile] Response received:', {
        authenticated: data.authenticated,
        signedIn: data.signedIn,
        hasProfile: !!data.profile,
        onboarded: data.onboarding?.completed
      });

      // NOT AUTHENTICATED - return immediately, no retries needed
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
        retryCount.current = 0;
        return;
      }

      // AUTHENTICATED BUT NO PROFILE - retry if under limit
      // This can happen immediately after redirect when profile hasn't loaded yet
      if (!data.profile) {
        if (retryCount.current < maxRetries) {
          retryCount.current++;
          const delay = Math.min(1000 * retryCount.current, 3000); // Linear backoff, max 3s
          console.log(`[useCurrentProfile] Authenticated but no profile, retrying in ${delay}ms (${retryCount.current}/${maxRetries})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          if (mounted.current) {
            return refresh();
          }
          return;
        }
        
        // Max retries - return authenticated but incomplete state
        console.warn('[useCurrentProfile] Authenticated but profile never loaded');
        if (mounted.current) {
          setState({
            loading: false,
            user: data.email ? { email: data.email, id: null, role: 'member' } : null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            error: 'Profile not found'
          });
        }
        retryCount.current = 0;
        return;
      }

      // SUCCESS - have auth + profile
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
        onboarded,
        hasNDA,
        kycStatus
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

      // Reset retry count on success
      retryCount.current = 0;

    } catch (error) {
      console.error('[useCurrentProfile] Error:', error);
      
      // Retry on any error if under limit
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        const delay = Math.min(1000 * retryCount.current, 3000);
        console.log(`[useCurrentProfile] Error, retrying in ${delay}ms (${retryCount.current}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (mounted.current) {
          return refresh();
        }
        return;
      }
      
      // Max retries reached
      console.error('[useCurrentProfile] Max retries reached after errors');
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