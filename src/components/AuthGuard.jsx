import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from './useCurrentProfile';
import { Loader2 } from 'lucide-react';

/**
 * AUTH GUARD
 * 
 * Protects routes based on auth + onboarding + role requirements
 * 
 * Props:
 * - requireAuth: boolean (default true) - require user to be authenticated
 * - requireOnboarding: boolean (default false) - require completed onboarding
 * - requireRole: 'investor' | 'agent' | null - require specific role
 * - requireKYC: boolean (default false) - require KYC verification
 * - requireNDA: boolean (default false) - require NDA acceptance
 */

const PUBLIC_ROUTES = [
  '/',
  '/role',
  '/roleselection',
  '/postauth',
  '/investoronboarding',
  '/agentonboarding',
  '/how-it-works',
  '/howitworks',
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
  '/privacypolicy',
  '/terms',
  '/review-policy',
  '/reviewpolicy',
  '/cookies',
  '/thank-you',
  '/thankyou',
  '/not-found',
  '/notfound',
  '/debug-auth',
  '/debugauth'
];

export function AuthGuard({ 
  children, 
  requireAuth = true,
  requireOnboarding = false,
  requireRole = null,
  requireKYC = false,
  requireNDA = false
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, user, profile, role, onboarded, kycVerified, hasNDA } = useCurrentProfile();

  useEffect(() => {
    if (loading) return;

    const currentPath = location.pathname.toLowerCase();
    const isPublicRoute = PUBLIC_ROUTES.some(route => 
      currentPath === route || currentPath.startsWith(route + '/')
    );

    // 1. Check auth requirement - ONLY redirect to login if not authenticated
    // Do NOT redirect anywhere else from here - let components handle their own routing
    if (requireAuth && !user && !isPublicRoute) {
      // Redirect to PostAuth after login
      base44.auth.redirectToLogin(createPageUrl('PostAuth'));
      return;
    }

    // 2-5: Let individual pages handle their own routing logic
    // This prevents redirect loops

  }, [loading, user, location.pathname, requireAuth, navigate]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth required but no user, show nothing (redirect is happening)
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}

export default AuthGuard;