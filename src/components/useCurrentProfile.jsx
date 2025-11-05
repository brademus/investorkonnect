
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
 * - kycVerified: boolean - true if KYC has been verified
 * - kycStatus: string - current KYC status ('unknown', 'pending', 'approved', 'rejected')
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
    kycVerified: false,
    kycStatus: 'unknown',
    error: null // Keep error state from original
  });
  
  // The mounted ref is no longer strictly necessary with the new refresh logic's full state reset,
  // but keeping it for consistency if any future updates reintroduce async state updates that need safeguarding.
  const mounted = useRef(true); 

  useEffect(() => {
    mounted.current = true;
    // Initial load handled by refresh
    refresh();
    
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = async () => {
    // Set loading to true explicitly when refresh is called
    if (mounted.current) { // Ensure component is mounted before setting state
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
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
        // If the fetch fails or response is not ok, clear all user/profile related state
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: null,
            onboarded: false,
            hasNDA: false,
            kycVerified: false,
            kycStatus: 'unknown',
            error: `Failed to load profile: ${response.statusText || 'Unknown error'}`
          });
        }
        return;
      }

      const data = await response.json();
      
      const profile = data.profile || null;
      const onboarded = !!(data.onboarding?.completed || profile?.onboarding_completed_at);
      const role = profile?.user_role || profile?.user_type || null;
      const hasNDA = profile?.nda_accepted || false;
      const kycVerified = profile?.kyc_verified || false;
      const kycStatus = profile?.kyc_status || 'unknown';

      if (mounted.current) {
        setState({
          loading: false,
          user: data.user || null, // Assuming functions/me also returns the user object
          profile,
          role,
          onboarded,
          hasNDA,
          kycVerified,
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
          kycVerified: false,
          kycStatus: 'unknown',
          error: error.message || 'Failed to load profile'
        });
      }
    }
  };

  return {
    ...state, // Spread all properties from the state object
    refresh
  };
}

export default useCurrentProfile;
