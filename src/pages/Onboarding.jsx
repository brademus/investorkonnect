import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2 } from "lucide-react";

/**
 * ONBOARDING REDIRECTOR
 * 
 * This page replaces the old onboarding form.
 * It routes users to the appropriate NEW onboarding flow based on their auth state and role.
 * 
 * Logic:
 * - Not authenticated → redirect to login with callback
 * - Authenticated but no role → go to RoleSelection
 * - Role = investor → go to NEW InvestorOnboarding
 * - Role = agent → go to AgentOnboarding
 * 
 * The old onboarding UI is completely disabled and will never appear.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { loading, user, profile } = useCurrentProfile();

  useEffect(() => {
    if (loading) return;

    console.log('[Onboarding Redirector] Auth state:', { user: !!user, profile: !!profile, role: profile?.user_role });

    // 1) Not authenticated → go to login, then back via RoleSelection
    if (!user) {
      console.log('[Onboarding Redirector] Not authenticated, redirecting to login');
      const callbackUrl = createPageUrl("RoleSelection") || window.location.pathname;
      base44.auth.redirectToLogin(callbackUrl);
      return;
    }

    // 2) Authenticated but no role yet → go pick investor or agent
    if (!profile || !profile.user_role || profile.user_role === "member") {
      console.log('[Onboarding Redirector] No role set, redirecting to RoleSelection');
      navigate(createPageUrl("RoleSelection"), { replace: true });
      return;
    }

    // 3) Role is investor → go to NEW investor onboarding
    if (profile.user_role === "investor") {
      console.log('[Onboarding Redirector] Investor role detected, redirecting to InvestorOnboarding');
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      return;
    }

    // 4) Role is agent → go to agent onboarding
    if (profile.user_role === "agent") {
      console.log('[Onboarding Redirector] Agent role detected, redirecting to AgentOnboarding');
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
      return;
    }

    // 5) Fallback: unknown role → force re-selection
    console.log('[Onboarding Redirector] Unknown role, redirecting to RoleSelection');
    navigate(createPageUrl("RoleSelection"), { replace: true });
  }, [loading, user, profile, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Redirecting to onboarding...</p>
      </div>
    </div>
  );
}