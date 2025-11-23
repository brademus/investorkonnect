import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from './useCurrentProfile';
import { useWizard } from './WizardContext';
import { Loader2 } from 'lucide-react';

/**
 * STEP GUARD
 * 
 * Enforces the linear wizard flow:
 * Map → Role → Auth → Onboarding → Verify → NDA → Matching/Dashboard → Room
 * 
 * Each step requires all previous steps to be completed.
 * Redirects user back to the first incomplete step.
 */

const WIZARD_STEPS = {
  MAP: 0,           // /
  ROLE: 1,          // /role
  AUTH: 2,          // handled by Base44
  ONBOARDING: 3,    // /onboarding/investor or /onboarding/agent
  VERIFY: 4,        // /verify
  NDA: 5,           // /nda
  MATCHING: 6,      // /matches (investor only)
  ROOM: 7           // /room/:id
};

export function StepGuard({ children, requiredStep }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, user, profile, role, onboarded, kycVerified, hasNDA } = useCurrentProfile();
  const { selectedState, selectedRole } = useWizard();

  useEffect(() => {
    if (loading) return;

    // Determine current completion level
    const hasState = selectedState || profile?.target_state || profile?.markets?.[0];
    const hasRole = role && role !== 'member';
    const hasAuth = !!user;
    const hasOnboarded = onboarded;
    const hasVerified = kycVerified;
    const hasNDAAccepted = hasNDA;

    // Find first incomplete step
    let redirectTo = null;

    if (requiredStep >= WIZARD_STEPS.MAP && !hasState) {
      redirectTo = createPageUrl('Home');
    } else if (requiredStep >= WIZARD_STEPS.ROLE && !hasRole) {
      redirectTo = createPageUrl('RoleSelection');
    } else if (requiredStep >= WIZARD_STEPS.AUTH && !hasAuth) {
      // Redirect to Base44 login, will return to wizard after
      base44.auth.redirectToLogin(location.pathname);
      return;
    } else if (requiredStep >= WIZARD_STEPS.ONBOARDING && !hasOnboarded) {
      // Redirect to role-specific onboarding
      if (role === 'investor') {
        redirectTo = createPageUrl('InvestorOnboarding');
      } else if (role === 'agent') {
        redirectTo = createPageUrl('AgentOnboarding');
      } else {
        redirectTo = createPageUrl('RoleSelection');
      }
    } else if (requiredStep >= WIZARD_STEPS.VERIFY && !hasVerified) {
      redirectTo = createPageUrl('Verify');
    } else if (requiredStep >= WIZARD_STEPS.NDA && !hasNDAAccepted) {
      redirectTo = createPageUrl('NDA');
    }

    if (redirectTo && redirectTo !== location.pathname) {
      navigate(redirectTo, { replace: true });
    }

  }, [loading, user, profile, role, onboarded, kycVerified, hasNDA, selectedState, selectedRole, requiredStep, navigate, location.pathname]);

  // Show loading while checking
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

  // All prerequisites met - render children
  return <>{children}</>;
}

export default StepGuard;