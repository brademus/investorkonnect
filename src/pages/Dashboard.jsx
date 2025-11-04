import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2 } from "lucide-react";
import InvestorHome from "./InvestorHome";
import AgentHome from "./AgentHome";

function DashboardContent() {
  const navigate = useNavigate();
  const { loading, user, role, onboarded } = useCurrentProfile();

  // Show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - AuthGuard will handle redirect
  if (!user) {
    return null;
  }

  // Not onboarded - redirect to onboarding
  if (!onboarded) {
    navigate(createPageUrl("Onboarding"), { replace: true });
    return null;
  }

  // Render role-specific home (NO redirect, conditional rendering to avoid loops)
  if (role === 'investor') {
    return <InvestorHome />;
  }

  if (role === 'agent') {
    return <AgentHome />;
  }

  // Fallback for users without role (shouldn't happen after onboarding)
  navigate(createPageUrl("Onboarding"), { replace: true });
  return null;
}

export default function Dashboard() {
  return (
    <AuthGuard requireAuth={true}>
      <DashboardContent />
    </AuthGuard>
  );
}