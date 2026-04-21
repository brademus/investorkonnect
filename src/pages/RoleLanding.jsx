import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { createPageUrl } from "@/components/utils";
import { Logo } from "@/components/Logo";
import { TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function RoleLanding() {
  const navigate = useNavigate();
  const location = useLocation();

  // If accessed via /RoleLanding, redirect to clean root URL
  useEffect(() => {
    if (location.pathname === "/RoleLanding") {
      navigate("/", { replace: true });
    }
  }, [location.pathname]);

  // If user is already logged in, skip role selection — reuse AuthContext state (no extra API call)
  const { isAuthenticated, isLoadingAuth } = useAuth();
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      navigate(createPageUrl("PostAuth"), { replace: true });
    }
  }, [isLoadingAuth, isAuthenticated]);

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center px-4 py-6 md:py-0">
      <div className="max-w-5xl w-full">
        {/* Logo + title — compressed on mobile */}
        <div className="text-center mb-4 md:mb-12">
          <Logo size="large" showText={true} className="mx-auto mb-3 md:mb-6 scale-75 md:scale-100 origin-center" />
          <h1 className="text-2xl md:text-5xl font-light text-[#FAFAFA] mb-2 md:mb-4 leading-tight">
            Welcome to <span className="text-[#E3C567]">Investor Konnect</span>
          </h1>
          <p className="text-sm md:text-lg text-[#808080] max-w-2xl mx-auto px-2">
            A trusted platform matching real estate investors with vetted agents
          </p>
        </div>

        {/* Role Cards — tighter on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
          {/* Investor Card */}
          <button
            onClick={() => navigate(createPageUrl("InvestorLanding"))}
            className="group relative bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl md:rounded-3xl p-4 md:p-8 hover:border-[#E3C567] transition-all hover:shadow-[0_0_40px_rgba(227,197,103,0.2)] active:scale-[0.98]"
          >
            <div className="flex items-center md:items-start justify-between mb-3 md:mb-6">
              <div className="w-10 h-10 md:w-16 md:h-16 bg-[#E3C567]/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <TrendingUp className="w-5 h-5 md:w-8 md:h-8 text-[#E3C567]" />
              </div>
              <div className="md:hidden inline-flex items-center gap-1 text-[#E3C567] font-semibold text-sm">
                <span>Start</span>
                <span className="text-lg">→</span>
              </div>
            </div>

            <div className="text-left">
              <h2 className="text-base md:text-2xl font-bold text-[#FAFAFA] mb-1 md:mb-3">I'M AN INVESTOR</h2>
              <p className="text-xs md:text-base text-[#808080] mb-3 md:mb-6 line-clamp-2 md:line-clamp-none">
                Create deals, upload and verify contracts, and lock in with investor-focused agents.
              </p>

              {/* Bullet list — hidden on mobile to save space */}
              <div className="hidden md:block space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Create and manage deals</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Verify seller contracts</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Sign & lock in with DocuSign</span>
                </div>
              </div>

              {/* Desktop arrow CTA */}
              <div className="hidden md:inline-flex items-center gap-2 text-[#E3C567] font-semibold group-hover:gap-3 transition-all">
                <span>Build Investor Profile</span>
                <span className="text-xl">→</span>
              </div>
            </div>
          </button>

          {/* Agent Card */}
          <button
            onClick={() => navigate(createPageUrl("AgentLanding"))}
            className="group relative bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl md:rounded-3xl p-4 md:p-8 hover:border-[#E3C567] transition-all hover:shadow-[0_0_40px_rgba(227,197,103,0.2)] active:scale-[0.98]"
          >
            <div className="flex items-center md:items-start justify-between mb-3 md:mb-6">
              <div className="w-10 h-10 md:w-16 md:h-16 bg-[#E3C567]/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Users className="w-5 h-5 md:w-8 md:h-8 text-[#E3C567]" />
              </div>
              <div className="md:hidden inline-flex items-center gap-1 text-[#E3C567] font-semibold text-sm">
                <span>Start</span>
                <span className="text-lg">→</span>
              </div>
            </div>

            <div className="text-left">
              <h2 className="text-base md:text-2xl font-bold text-[#FAFAFA] mb-1 md:mb-3">I'M AN AGENT</h2>
              <p className="text-xs md:text-base text-[#808080] mb-3 md:mb-6 line-clamp-2 md:line-clamp-none">
                Work with serious investors, sign internal agreements, and manage deal milestones in one place.
              </p>

              <div className="hidden md:block space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Qualified investor deal rooms</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Clear deal board + documents</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Secure lock-in before access</span>
                </div>
              </div>

              <div className="hidden md:inline-flex items-center gap-2 text-[#E3C567] font-semibold group-hover:gap-3 transition-all">
                <span>Build Agent Profile</span>
                <span className="text-xl">→</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}