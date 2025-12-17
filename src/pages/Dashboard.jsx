import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import LoadingAnimation from "@/components/LoadingAnimation";
import Pipeline from "./Pipeline";
import ErrorBoundary from "@/components/ErrorBoundary";

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
        const user = await base44.auth.me();
        
        if (!user) {
          // Not logged in
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

        // All good - show dashboard
        setProfile(userProfile);
        setLoading(false);

      } catch (error) {
        console.error('[Dashboard] Error:', error);
        navigate(createPageUrl("Home"), { replace: true });
      }
    };

    checkAccess();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  // Show Pipeline as the main dashboard for all users
  try {
    return (
      <ErrorBoundary>
        <Pipeline />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error("Dashboard render error:", error);
    return (
       <div className="min-h-screen flex items-center justify-center text-white">
          <p>Something went wrong loading the dashboard. Please refresh.</p>
       </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <LoadingAnimation className="w-64 h-64" />
    </div>
  );
}