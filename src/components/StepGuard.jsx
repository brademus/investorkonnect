import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from './useCurrentProfile';
import { useWizard } from './WizardContext';
import LoadingAnimation from '@/components/LoadingAnimation';

/**
 * STEP GUARD
 * 
 * Enforces the linear wizard flow:
 * Map -> Role -> Auth -> Onboarding -> Subscription (Investor) -> Verify -> NDA -> Dashboard
 * 
 * IMPORTANT: This guard only applies to pages that REQUIRE a certain step.
 * Pages like Dashboard/Pipeline should NOT use high requiredStep values
 * because they need to show the SetupChecklist for incomplete users.
 */

const WIZARD_STEPS = {
  MAP: 0,
  ROLE: 1,
  AUTH: 2,
  ONBOARDING: 3,
  SUBSCRIPTION: 4,
  VERIFY: 5,
  NDA: 6,
  MATCHING: 7,
  ROOM: 8
};

export function StepGuard({ children, requiredStep }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    loading, user, profile, role, onboarded, 
    kycVerified, hasNDA, isPaidSubscriber 
  } = useCurrentProfile();
  const { selectedState } = useWizard();

  useEffect(() => {
    if (loading) return;

    const hasState = selectedState || profile?.target_state || profile?.markets?.[0];
    const hasRole = role && role !== 'member';
    const hasAuth = !!user;
    const hasOnboarded = onboarded;
    const hasSubscription = role === 'agent' || isPaidSubscriber;
    const hasVerified = kycVerified;
    const hasNDAAccepted = hasNDA;

    let redirectTo = null;

    // 1. Location Selection
    if (requiredStep >= WIZARD_STEPS.MAP && !hasState) {
      redirectTo = createPageUrl('Home');
    } 
    // 2. Role Selection
    else if (requiredStep >= WIZARD_STEPS.ROLE && !hasRole) {
      redirectTo = createPageUrl('RoleSelection');
    } 
    // 3. Authentication
    else if (requiredStep >= WIZARD_STEPS.AUTH && !hasAuth) {
      base44.auth.redirectToLogin(location.pathname);
      return;
    } 
    // 4. Onboarding Questions
    else if (requiredStep >= WIZARD_STEPS.ONBOARDING && !hasOnboarded) {
      if (role === 'investor') redirectTo = createPageUrl('InvestorOnboarding');
      else if (role === 'agent') redirectTo = createPageUrl('AgentOnboarding');
      else redirectTo = createPageUrl('RoleSelection');
    } 
    // 5. Subscription (Investors only)
    else if (requiredStep >= WIZARD_STEPS.SUBSCRIPTION && !hasSubscription) {
      redirectTo = createPageUrl('Pricing');
    }
    // 6. Identity Verification
    else if (requiredStep >= WIZARD_STEPS.VERIFY && !hasVerified) {
      redirectTo = createPageUrl('IdentityVerification');
    }
    // 7. NDA
    else if (requiredStep >= WIZARD_STEPS.NDA && !hasNDAAccepted) {
      redirectTo = createPageUrl('NDA');
    }

    if (redirectTo && redirectTo !== location.pathname) {
      navigate(redirectTo, { replace: true });
    }

  }, [loading, user, profile, role, onboarded, kycVerified, hasNDA, isPaidSubscriber, selectedState, requiredStep, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
          <p className="text-[#808080]">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default StepGuard;
