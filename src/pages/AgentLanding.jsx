import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import LegalFooterLinks from "@/components/LegalFooterLinks";
import {
  Users, DollarSign, TrendingUp, Shield, Award,
  CheckCircle, ArrowLeft, Briefcase
} from "lucide-react";

export default function AgentLanding() {
  const navigate = useNavigate();

  const handleLogin = () => {
    const target = createPageUrl("PostAuth") + "?selectedRole=agent";
    base44.auth.redirectToLogin(target);
  };

  const handleGetStarted = async () => {
    // Pass role hint for brand new users; existing users will keep current role
    const target = createPageUrl("PostAuth") + "?selectedRole=agent";
    try {
      const loggedIn = await base44.auth.isAuthenticated();
      if (loggedIn) {
        window.location.href = target;
      } else {
        base44.auth.redirectToLogin(target);
      }
    } catch (_) {
      base44.auth.redirectToLogin(target);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Fixed Header */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#1F1F1F] bg-[#0D0D0D]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(createPageUrl("RoleLanding"))}
              className="text-[#808080] hover:text-[#E3C567] transition-colors">

              <ArrowLeft size={20} />
            </button>
            <Logo size="default" showText={true} />
            <span className="text-sm text-[#60A5FA] font-medium"></span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogin}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] px-5 py-2.5 text-sm font-medium text-[#FAFAFA] shadow-sm transition-all hover:border-[#E3C567] hover:bg-[#141414]">

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
              For Real Estate Agents
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-light text-[#FAFAFA] mb-6 leading-tight tracking-wide">
            Win more investor clients—and manage every deal in one place.
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-[#808080] mb-10 max-w-2xl mx-auto">
            Get connected to serious investors, keep contracts organized, and use a clean deal board to move deals forward.
          </p>

          {/* CTA Button */}
          <div className="mb-8">
            <Button
              onClick={handleGetStarted}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black px-12 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-[0_8px_20px_rgba(227,197,103,0.4)] transition-all">

              Get Started as Agent
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#808080]">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} color="#E3C567" />
              <span>Investor deal rooms</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={20} color="#E3C567" />
              <span>Documents + milestones in the deal board</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={20} color="#E3C567" />
              <span>Secure lock-in before full access</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-[#FAFAFA] text-center mb-12">
            Why agents use Investor Konnect
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <Users size={24} color="#E3C567" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Serious Investors</h3>
              <p className="text-[#808080]">
                Work with investors who already have a deal in motion and want an agent to execute.
              </p>
            </div>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <Briefcase size={24} color="#E3C567" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Clean Deal Management</h3>
              <p className="text-[#808080]">
                Everything tied to the deal—contracts, signatures, updates, walkthrough/inspection scheduling—stays organized.
              </p>
            </div>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <Award size={24} color="#E3C567" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Lock-In Clarity</h3>
              <p className="text-[#808080]">
                Internal agreement signing creates clear commitment—then the deal board unlocks what both sides need.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Legal Footer Links */}
      <LegalFooterLinks />
    </div>);

}