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
      // Use the /functions/me endpoint which returns complete profile data
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
        // Not authenticated
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