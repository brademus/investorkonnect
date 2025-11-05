/**
 * Simplified Auth Guard
 * Enforces authentication on protected routes
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/how-it-works',
  '/investors',
  '/agents',
  '/pricing',
  '/reviews',
  '/resources',
  '/faq',
  '/about',
  '/contact',
  '/security',
  '/nda',
  '/privacy-policy',
  '/terms',
  '/review-policy',
  '/cookies',
  '/thank-you',
  '/not-found',
  '/debug-auth'
];

export function AuthGuard({ children, requireAuth = false }) {
  const location = useLocation();
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'

  useEffect(() => {
    checkAuth();
  }, [location.pathname]);

  const checkAuth = async () => {
    try {
      // Wait for Base44 session
      const isAuth = await base44.auth.isAuthenticated();
      
      setAuthState(isAuth ? 'authenticated' : 'unauthenticated');
    } catch (error) {
      console.error('[AuthGuard] Auth check error:', error);
      setAuthState('unauthenticated');
    }
  };

  // Still loading - show spinner
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // Unauthenticated on protected route - redirect to login
  if (requireAuth && authState === 'unauthenticated' && !isPublicRoute) {
    // Trigger Base44 login flow
    base44.auth.redirectToLogin();
    return null;
  }

  // All checks passed - render children
  return <>{children}</>;
}

export default AuthGuard;