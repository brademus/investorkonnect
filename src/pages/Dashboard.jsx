import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, ArrowRight, TrendingUp, Users } from "lucide-react";
import InvestorHome from "./InvestorHome";
import AgentHome from "./AgentHome";

/**
 * DASHBOARD - Smart Role Router with Onboarding Gates
 * 
 * After login, users land here. If they haven't completed NEW onboarding,
 * we show a blocking "Complete your profile" prompt with a clear CTA.
 * Only after onboarding completion do they see the real dashboard.
 */
function DashboardContent() {
  const navigate = useNavigate();
  const { loading, user, role, onboarded, profile } = useCurrentProfile();

  useEffect(() => {
    // Check if simple onboarding is complete (location + role)
    const hasSimpleOnboarding = !!(profile?.target_state && profile?.user_role);
    
    // If no simple onboarding, send to SimpleOnboarding
    if (!loading && user && !hasSimpleOnboarding) {
      navigate(createPageUrl("SimpleOnboarding"), { replace: true });
      return;
    }
    
    // If no role set at all (shouldn't happen after simple onboarding), fallback
    if (!loading && user && (!role || role === 'member') && hasSimpleOnboarding) {
      // Role should be set after simple onboarding, but just in case
      navigate(createPageUrl("SimpleOnboarding"), { replace: true });
    }
  }, [loading, user, role, profile, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin" />
      </div>
    );
  }

  // ADMIN BYPASS: Skip all checks for admins
  if (user?.role === 'admin') {
    console.log('[Dashboard] Admin user - bypassing all checks');
    // Show investor dashboard by default for admins
    return <InvestorHome />;
  }

  // NON-BLOCKING: Show appropriate dashboard based on role
  // Setup checklist will appear at top of dashboard, not blocking
  if (role === 'investor') {
    return <InvestorHome />;
  }

  if (role === 'agent') {
    return <AgentHome />;
  }

  // Fallback
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
        <p className="text-[#6B7280]">Setting up your dashboard...</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthGuard requireAuth={true}>
      <DashboardContent />
    </AuthGuard>
  );
}