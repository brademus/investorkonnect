import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useCurrentProfile - Single source of truth for auth + profile state
 * 
 * Returns:
 * - loading: boolean - true while fetching initial data
 * - user: object | null - Base44 auth user (id, email, role)
 * - profile: object | null - Profile from database
 * - role: 'investor' | 'agent' | 'member' - derived from profile
 * - onboarded: boolean - true if onboarding_completed_at is set
 * - refresh: function - manually refetch profile data
 * - error: string | null - error message if fetch failed
 */
export function useCurrentProfile() {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null,
    role: 'member',
    onboarded: false,
    error: null
  });
  
  const mounted = useRef(true);
  const fetching = useRef(false);

  useEffect(() => {
    mounted.current = true;
    loadProfile();
    
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadProfile = async () => {
    if (fetching.current) return;
    fetching.current = true;

    try {
      // Check auth first
      const isAuth = await base44.auth.isAuthenticated();
      
      if (!isAuth) {
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: 'member',
            onboarded: false,
            error: null
          });
        }
        fetching.current = false;
        return;
      }

      // Get user
      const user = await base44.auth.me();
      
      if (!user) {
        if (mounted.current) {
          setState({
            loading: false,
            user: null,
            profile: null,
            role: 'member',
            onboarded: false,
            error: null
          });
        }
        fetching.current = false;
        return;
      }

      // Fetch profile via /functions/me
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
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      
      // Derive role from profile data
      const derivedRole = data.profile?.user_role || 
                         data.profile?.user_type || 
                         data.profile?.role || 
                         'member';
      
      // Check onboarding status
      const isOnboarded = !!(data.profile?.onboarding_completed_at || data.onboarding?.completed);

      if (mounted.current) {
        setState({
          loading: false,
          user: user,
          profile: data.profile || null,
          role: derivedRole,
          onboarded: isOnboarded,
          error: null
        });
      }

    } catch (error) {
      console.error('[useCurrentProfile] Error:', error);
      if (mounted.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load profile'
        }));
      }
    } finally {
      fetching.current = false;
    }
  };

  const refresh = () => {
    setState(prev => ({ ...prev, loading: true }));
    loadProfile();
  };

  return {
    loading: state.loading,
    user: state.user,
    profile: state.profile,
    role: state.role,
    onboarded: state.onboarded,
    refresh,
    error: state.error
  };
}

export default useCurrentProfile;