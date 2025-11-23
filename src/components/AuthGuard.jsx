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

    const currentPath = location.pathname;
    const isPublicRoute = PUBLIC_ROUTES.some(route => 
      currentPath === route || currentPath.startsWith(route + '/')
    );

    // 1. Check auth requirement
    if (requireAuth && !user && !isPublicRoute) {
      base44.auth.redirectToLogin(currentPath);
      return;
    }

    // 2. Check onboarding requirement
    if (requireOnboarding && user && !onboarded) {
      // Send to role selection if no role
      if (!role || role === 'member') {
        navigate(createPageUrl('RoleSelection'), { replace: true });
        return;
      }
      
      // Send to appropriate onboarding
      if (role === 'investor') {
        navigate(createPageUrl('InvestorOnboarding'), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl('AgentOnboarding'), { replace: true });
      }
      return;
    }

    // 3. Check role requirement
    if (requireRole && role !== requireRole) {
      navigate(createPageUrl('Home'), { replace: true });
      return;
    }

    // 4. Check KYC requirement
    if (requireKYC && !kycVerified) {
      navigate(createPageUrl('Verify'), { replace: true });
      return;
    }

    // 5. Check NDA requirement (no redirect - let component handle)

  }, [loading, user, profile, role, onboarded, kycVerified, hasNDA, location.pathname, requireAuth, requireOnboarding, requireRole, requireKYC, requireNDA, navigate]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // All checks passed - render children
  return <>{children}</>;
}

export default AuthGuard;