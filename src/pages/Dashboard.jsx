import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Shield, ArrowRight, TrendingUp, Users } from "lucide-react";
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
  const { loading, user, role, onboarded } = useCurrentProfile();

  useEffect(() => {
    // If no role set at all, send to role selection
    if (!loading && user && (!role || role === 'member')) {
      navigate(createPageUrl("RoleSelection"), { replace: true });
    }
  }, [loading, user, role, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // INVESTOR NOT ONBOARDED - Show blocking prompt
  if (role === 'investor' && !onboarded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-blue-200 p-12">
            {/* Icon */}
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-10 h-10 text-blue-600" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold text-slate-900 text-center mb-4">
              One More Step to Get Started
            </h1>
            <p className="text-lg text-slate-600 text-center mb-8 max-w-xl mx-auto">
              Before you can access Investor Konnect, we need a bit more information about your investment goals and preferences. This helps us match you with the right agents.
            </p>

            {/* Why we need this */}
            <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Why we need this:
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Find agents who specialize in your investment strategy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Match your budget and market preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Provide agents with context before connecting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Unlock all platform features and deal rooms</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <Button
              onClick={() => navigate(createPageUrl("InvestorOnboarding"))}
              size="lg"
              className="w-full bg-blue-600 hover:bg-blue-700 h-16 text-lg font-semibold shadow-lg"
            >
              Complete My Investor Profile
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <p className="text-sm text-slate-500 text-center mt-4">
              Takes about 5 minutes • You only need to do this once
            </p>

            {/* Sign out option */}
            <div className="text-center mt-6">
              <button
                onClick={() => base44.auth.logout()}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Sign out instead
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AGENT NOT ONBOARDED - Show blocking prompt
  if (role === 'agent' && !onboarded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-emerald-200 p-12">
            {/* Icon */}
            <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-emerald-600" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold text-slate-900 text-center mb-4">
              Complete Your Agent Profile
            </h1>
            <p className="text-lg text-slate-600 text-center mb-8 max-w-xl mx-auto">
              Before you can access Investor Konnect, please complete your agent profile so investors can learn about your expertise and services.
            </p>

            {/* CTA */}
            <Button
              onClick={() => navigate(createPageUrl("AgentOnboarding"))}
              size="lg"
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-16 text-lg font-semibold shadow-lg"
            >
              Complete My Agent Profile
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <p className="text-sm text-slate-500 text-center mt-4">
              Takes about 3 minutes • Required to connect with investors
            </p>

            {/* Sign out option */}
            <div className="text-center mt-6">
              <button
                onClick={() => base44.auth.logout()}
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Sign out instead
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ONBOARDED - Show appropriate dashboard
  if (role === 'investor' && onboarded) {
    return <InvestorHome />;
  }

  if (role === 'agent' && onboarded) {
    return <AgentHome />;
  }

  // Fallback
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