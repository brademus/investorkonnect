import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const APP_ORIGIN = 'https://agent-vault-da3d088b.base44.app';

/**
 * useCurrentProfile - Single source of truth for auth + profile state
 * CRITICAL: All fetches must include credentials:'include' for cookie-based auth
 * 
 * Returns:
 * - loading: boolean - true while fetching initial data
 * - user: object | null - Base44 auth user (id, email, role)
 * - profile: object | null - Profile from database
 * - role: 'investor' | 'agent' | 'member' | null - derived from profile
 * - onboarded: boolean - true if onboarding_completed_at is set
 * - hasNDA: boolean - true if NDA has been accepted
 * - kycStatus: string - current KYC status ('unverified', 'pending', 'approved', 'needs_review', 'failed')
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
  const retryAttempted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    refresh();
    
    return () => {
      mounted.current = false;
    };
  }, []);

  const pingSession = async () => {
    try {
      const response = await fetch(`${APP_ORIGIN}/functions/sessionGet`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.ok && data.authenticated;
      }
      return false;
    } catch (error) {
      console.error('[useCurrentProfile] Session ping failed:', error);
      return false;
    }
  };

  const refresh = async () => {
    if (mounted.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      // CRITICAL: Include credentials for cookie-based auth
      const response = await fetch(`${APP_ORIGIN}/functions/me`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        // If /functions/me fails and we haven't retried, try session ping
        if (!retryAttempted.current) {
          console.log('[useCurrentProfile] /functions/me failed, attempting session ping...');
          retryAttempted.current = true;
          
          // Wait 300ms before retry (Safari needs a moment)
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const sessionActive = await pingSession();
          
          if (sessionActive && mounted.current) {
            console.log('[useCurrentProfile] Session active, retrying refresh...');
            // Recursive call to try again
            return refresh();
          }
        }
        
        // No session or retry exhausted
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycStatus: 'unverified',
            error: 'Not authenticated'
          });
        }
        return;
      }

      const data = await response.json();
      
      const profile = data.profile || null;
      const onboarded = !!(data.onboarding?.completed || profile?.onboarding_completed_at);
      const role = profile?.user_role || profile?.user_type || null;
      const hasNDA = profile?.nda_accepted || false;
      const kycStatus = profile?.kyc_status || 'unverified';

      if (mounted.current) {
        setState({
          loading: false,
          user: data.user || null,
          profile,
          role,
          onboarded,
          hasNDA,
          kycStatus,
          error: null
        });
      }

      // Reset retry flag on success
      retryAttempted.current = false;

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

  return {
    ...state,
    refresh
  };
}

export default useCurrentProfile;