import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Logo } from "@/components/Logo";
import { TrendingUp, Users } from "lucide-react";

export default function RoleLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
      <div className="max-w-5xl w-full">
        {/* Logo */}
        <div className="text-center mb-12">
          <Logo size="large" showText={true} className="mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-light text-[#FAFAFA] mb-4">
            Welcome to <span className="text-[#E3C567]">Investor Konnect</span>
          </h1>
          <p className="text-lg text-[#808080]">
            Choose how you want to get started
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Investor Card */}
          <button
            onClick={() => navigate(createPageUrl("InvestorLanding"))}
            className="group relative bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-8 hover:border-[#E3C567] transition-all hover:shadow-[0_0_40px_rgba(227,197,103,0.2)]"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-[#E3C567]/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-8 h-8 text-[#E3C567]" />
              </div>
            </div>
            
            <div className="text-left">
              <h2 className="text-2xl font-bold text-[#FAFAFA] mb-3">I'm an Investor</h2>
              <p className="text-[#808080] mb-6">
                Find investor-friendly agents, manage deals, and access market data for your real estate investments.
              </p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Connect with vetted agents</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Manage your deal pipeline</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Access off-market opportunities</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-[#E3C567] font-semibold group-hover:gap-3 transition-all">
                <span>Get Started as Investor</span>
                <span className="text-xl">→</span>
              </div>
            </div>
          </button>

          {/* Agent Card */}
          <button
            onClick={() => navigate(createPageUrl("AgentLanding"))}
            className="group relative bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-8 hover:border-[#E3C567] transition-all hover:shadow-[0_0_40px_rgba(227,197,103,0.2)]"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 bg-[#E3C567]/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-[#E3C567]" />
              </div>
            </div>
            
            <div className="text-left">
              <h2 className="text-2xl font-bold text-[#FAFAFA] mb-3">I'm an Agent</h2>
              <p className="text-[#808080] mb-6">
                Connect with serious investors, showcase your expertise, and grow your investment property business.
              </p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Get matched with investors</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Showcase your track record</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#FAFAFA]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567]" />
                  <span>Access qualified investor leads</span>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 text-[#E3C567] font-semibold group-hover:gap-3 transition-all">
                <span>Get Started as Agent</span>
                <span className="text-xl">→</span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12">
          <p className="text-sm text-[#808080]">
            Already have an account?{" "}
            <button
              onClick={() => window.location.href = createPageUrl("PostAuth")}
              className="text-[#E3C567] hover:underline font-medium"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}