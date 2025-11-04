/**
 * Simplified Session Management
 * NO CACHING, NO LOOPS - just simple Base44 session checks
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Simple hook to check authentication status
 */
export function useSession() {
  const [state, setState] = useState({
    status: 'loading',
    authenticated: false,
    user: null
  });

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      
      if (isAuth) {
        const user = await base44.auth.me();
        setState({
          status: 'authenticated',
          authenticated: true,
          user
        });
      } else {
        setState({
          status: 'unauthenticated',
          authenticated: false,
          user: null
        });
      }
    } catch (error) {
      console.error('[SessionManager] Error:', error);
      setState({
        status: 'unauthenticated',
        authenticated: false,
        user: null
      });
    }
  };

  const refresh = () => {
    return checkSession();
  };

  return {
    ...state,
    loading: state.status === 'loading',
    refresh
  };
}

export default {
  useSession
};