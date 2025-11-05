import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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

  useEffect(() => {
    let mounted = true;
    
    const loadProfile = async () => {
      try {
        // Simple auth check
        const user = await base44.auth.me();
        
        if (!mounted) return;
        
        if (!user) {
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
          return;
        }

        // Get profile
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        const profile = profiles[0] || null;

        setState({
          loading: false,
          user,
          profile,
          role: profile?.user_role || profile?.user_type || null,
          onboarded: !!profile?.onboarding_completed_at,
          hasNDA: profile?.nda_accepted || false,
          kycStatus: profile?.kyc_status || 'unverified',
          error: null
        });

      } catch (error) {
        if (!mounted) return;
        
        setState({
          loading: false,
          user: null,
          profile: null,
          role: null,
          onboarded: false,
          hasNDA: false,
          kycStatus: 'unverified',
          error: error.message
        });
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

export default useCurrentProfile;