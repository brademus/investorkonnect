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
  const { loading, user, role, onboarded } = useCurrentProfile();

  useEffect(() => {
    // If no role set at all, send to role selection
    if (!loading && user && (!role || role === 'member')) {
      navigate(createPageUrl("RoleSelection"), { replace: true });
    }
  }, [loading, user, role, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin" />
      </div>
    );
  }

  // INVESTOR NOT ONBOARDED - Show blocking prompt
  if (role === 'investor' && !onboarded) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-12 shadow-xl">
            {/* Icon */}
            <div className="w-20 h-20 bg-[#FEF3C7] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-10 h-10 text-[#D3A029]" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold text-[#111827] text-center mb-4">
              One More Step to Get Started
            </h1>
            <p className="text-lg text-[#6B7280] text-center mb-8 max-w-xl mx-auto">
              Before you can access Investor Konnect, we need a bit more information about your investment goals and preferences. This helps us match you with the right agents.
            </p>

            {/* Why we need this */}
            <div className="bg-[#FFFBEB] rounded-2xl p-6 mb-8 border border-[#FCD34D]">
              <h3 className="font-bold text-[#92400E] mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Why we need this:
              </h3>
              <ul className="space-y-2 text-sm text-[#92400E]">
                <li className="flex items-start gap-2">
                  <span className="text-[#D3A029] mt-0.5">•</span>
                  <span>Find agents who specialize in your investment strategy</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#D3A029] mt-0.5">•</span>
                  <span>Match your budget and market preferences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#D3A029] mt-0.5">•</span>
                  <span>Provide agents with context before connecting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#D3A029] mt-0.5">•</span>
                  <span>Unlock all platform features and deal rooms</span>
                </li>
              </ul>
            </div>

            {/* CTA */}
            <button
              onClick={() => navigate(createPageUrl("InvestorOnboarding"))}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5 w-full h-16"
            >
              Complete My Investor Profile
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-sm text-[#6B7280] text-center mt-4">
              Takes about 5 minutes • You only need to do this once
            </p>

            {/* Sign out option */}
            <div className="text-center mt-6">
              <button
                onClick={() => base44.auth.logout()}
                className="text-sm text-[#6B7280] hover:text-[#111827] underline"
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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-12 shadow-xl">
            {/* Icon */}
            <div className="w-20 h-20 bg-[#D1FAE5] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-[#10B981]" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold text-[#111827] text-center mb-4">
              Complete Your Agent Profile
            </h1>
            <p className="text-lg text-[#6B7280] text-center mb-8 max-w-xl mx-auto">
              Before you can access Investor Konnect, please complete your agent profile so investors can learn about your expertise and services.
            </p>

            {/* CTA */}
            <button
              onClick={() => navigate(createPageUrl("AgentOnboarding"))}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#10B981] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#10B981]/30 transition-all hover:bg-[#059669] hover:shadow-xl hover:-translate-y-0.5 w-full h-16"
            >
              Complete My Agent Profile
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-sm text-[#6B7280] text-center mt-4">
              Takes about 3 minutes • Required to connect with investors
            </p>

            {/* Sign out option */}
            <div className="text-center mt-6">
              <button
                onClick={() => base44.auth.logout()}
                className="text-sm text-[#6B7280] hover:text-[#111827] underline"
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