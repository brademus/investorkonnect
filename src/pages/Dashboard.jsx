import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2 } from "lucide-react";
import InvestorHome from "./InvestorHome";
import AgentHome from "./AgentHome";

/**
 * DASHBOARD - Smart Role Router
 * 
 * This page detects the user's role and shows the appropriate dashboard.
 * Uses conditional RENDERING, not navigation, to avoid redirect loops.
 * 
 * GATE: If investor is not onboarded (NEW onboarding), redirect to InvestorOnboarding.
 */
function DashboardContent() {
  const navigate = useNavigate();
  const { loading, user, role, onboarded } = useCurrentProfile();

  useEffect(() => {
    // GATE: Redirect investors who haven't completed NEW onboarding
    if (!loading && user) {
      if (role === 'investor' && !onboarded) {
        console.log('[Dashboard] Investor not onboarded, redirecting to InvestorOnboarding');
        navigate(createPageUrl("InvestorOnboarding"), { replace: true });
        return;
      }
      
      // If no role set, send to role selection
      if (!role || role === 'member') {
        console.log('[Dashboard] No role set, redirecting to RoleSelection');
        navigate(createPageUrl("RoleSelection"), { replace: true });
        return;
      }
    }
  }, [loading, user, role, onboarded, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Conditional rendering based on role (NO navigation in render)
  if (role === 'investor' && onboarded) {
    return <InvestorHome />;
  }

  if (role === 'agent') {
    return <AgentHome />;
  }

  // Fallback for users without role
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Setting up your dashboard...</p>
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