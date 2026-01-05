import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import LegalFooterLinks from "@/components/LegalFooterLinks";
import { 
  Shield, MapPin, FileText, TrendingUp, Star, 
  CheckCircle, ArrowLeft
} from "lucide-react";

export default function InvestorLanding() {
  const navigate = useNavigate();

  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl("PostAuth"));
  };

  const handleGetStarted = () => {
    base44.auth.redirectToLogin(createPageUrl("RoleSelection"));
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Fixed Header */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#1F1F1F] bg-[#0D0D0D]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(createPageUrl("RoleLanding"))}
              className="text-[#808080] hover:text-[#E3C567] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Logo size="default" showText={true} />
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleLogin} 
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] px-5 py-2.5 text-sm font-medium text-[#FAFAFA] shadow-sm transition-all hover:border-[#E3C567] hover:bg-[#141414]"
            >
              Log in
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-full mb-8">
            <div className="w-2 h-2 rounded-full bg-[#E3C567]" />
            <span className="text-sm font-medium text-[#E3C567]">
              For Real Estate Investors
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-light text-[#FAFAFA] mb-6 leading-tight tracking-wide">
            Connect with agents who{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-[#E3C567]">speak your language</span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-[#808080] mb-10 max-w-2xl mx-auto">
            Stop wasting time explaining cap rates and BRRRR to residential agents. 
            Find vetted investor-friendly agents in your target market instantly.
          </p>

          {/* CTA Button */}
          <div className="mb-8">
            <Button
              onClick={handleGetStarted}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black px-12 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-[0_8px_20px_rgba(227,197,103,0.4)] transition-all"
            >
              Get Started as Investor
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#808080]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#E3C567]" />
              <span>Vetted Agents</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#E3C567]" />
              <span>Deal Pipeline Management</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#E3C567]" />
              <span>Off-Market Access</span>
            </div>
          </div>

          {/* Video Section */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#1F1F1F]">
              <iframe 
                src="https://drive.google.com/file/d/1TZXb6W9V5_vVITTIxt7tEXLtoFarKzAf/preview" 
                className="w-full aspect-video"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-[#FAFAFA] text-center mb-12">
            Everything you need to scale your portfolio
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Vetted Agents</h3>
              <p className="text-[#808080]">
                Work with agents who understand investor metrics, have proven track records, and specialize in your market.
              </p>
            </div>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Deal Management</h3>
              <p className="text-[#808080]">
                Track all your deals in one place with our visual pipeline, secure document storage, and built-in chat.
              </p>
            </div>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Market Intelligence</h3>
              <p className="text-[#808080]">
                Get access to off-market deals, local market insights, and exclusive opportunities from connected agents.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Legal Footer Links */}
      <LegalFooterLinks />
    </div>
  );
}