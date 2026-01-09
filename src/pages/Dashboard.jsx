import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import LoadingAnimation from "@/components/LoadingAnimation";
import Pipeline from "./Pipeline";
import ErrorBoundary from "@/components/ErrorBoundary";
import SetupChecklist from "@/components/SetupChecklist";

/**
 * DASHBOARD - Shows role-specific dashboard
 * 
 * Guards:
 * 1. Must be logged in
 * 2. Must have role selected
 * 3. Must have completed onboarding
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Add timeout to prevent infinite loading if auth hangs
        const user = await Promise.race([
          base44.auth.me(),
          new Promise((resolve) => setTimeout(() => resolve(null), 6000))
        ]);
        
        if (!user) {
          // Not logged in or timed out — force redirect to login
          base44.auth.redirectToLogin(createPageUrl("PostAuth"));
          return;
        }

        // Admin bypass
        if (user.role === 'admin') {
          setProfile({ user_role: 'investor' }); // Show investor dashboard for admin
          setLoading(false);
          return;
        }

        // Get profile
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        const userProfile = profiles[0];

        const role = userProfile?.user_role;
        const hasRole = role && role !== 'member';
        const hasBasicOnboarding = userProfile?.onboarding_step === 'basic_complete' || userProfile?.onboarding_step === 'deep_complete';
        const isOnboarded = !!userProfile?.onboarding_completed_at;

        if (!hasRole) {
          // No role - go to RoleSelection
          navigate(createPageUrl("RoleSelection"), { replace: true });
          return;
        }

        if (!hasBasicOnboarding) {
          // Has role but hasn't done basic 3-step onboarding yet
          if (role === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (role === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          }
          return;
        }

        // If they've done basic but not deep onboarding, show Dashboard with checklist
        // (isOnboarded will be false, so checklist will show "Complete Profile" step)

        // All good - redirect to Pipeline (canonical dashboard)
        navigate(createPageUrl("Pipeline"), { replace: true });

      } catch (error) {
        console.error('[Dashboard] Error:', error);
        navigate(createPageUrl("Home"), { replace: true });
      }
    };

    checkAccess();
  }, [navigate]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <div className="text-center">
        <LoadingAnimation className="w-64 h-64 mx-auto mb-3" />
        <p className="text-sm text-[#808080]">Redirecting to Pipeline...</p>
      </div>
    </div>
  );
}