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
 */
function DashboardContent() {
  const navigate = useNavigate();
  const { loading, user, role, onboarded } = useCurrentProfile();

  useEffect(() => {
    // Only redirect if missing critical requirements
    if (!loading && user && !onboarded) {
      navigate(createPageUrl("Home"), { replace: true });
    }
  }, [loading, user, onboarded, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Conditional rendering based on role (NO navigation)
  if (role === 'investor') {
    return <InvestorHome />;
  }

  if (role === 'agent') {
    return <AgentHome />;
  }

  // Fallback for users without role
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Select Your Role</h2>
        <p className="text-slate-600 mb-6">Choose whether you're an investor or agent to continue</p>
        <button
          onClick={() => navigate(createPageUrl("RoleSelection"))}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          Select Role
        </button>
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