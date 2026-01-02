import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Users, DollarSign, TrendingUp, Shield, Award,
  CheckCircle, ArrowLeft, Briefcase
} from "lucide-react";

export default function AgentLanding() {
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#60A5FA]/20 border border-[#60A5FA]/30 rounded-full mb-8">
            <div className="w-2 h-2 rounded-full bg-[#60A5FA]" />
            <span className="text-sm font-medium text-[#60A5FA]">
              For Real Estate Agents
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-light text-[#FAFAFA] mb-6 leading-tight tracking-wide">
            Build your{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-[#E3C567]">investment property</span>
            </span>
            {" "}practice
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-[#808080] mb-10 max-w-2xl mx-auto">
            Get matched with serious investors looking for agents who understand their business. 
            Showcase your expertise and grow your book of investment clients.
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
              <span>Qualified Investor Leads</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={20} color="#E3C567" />
              <span>Deal Management Tools</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={20} color="#E3C567" />
              <span>Smart Matching</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-[#FAFAFA] text-center mb-12">
            Why investor-focused agents choose us
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <Users size={24} color="#E3C567" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Qualified Investors</h3>
              <p className="text-[#808080]">
                Connect with serious investors who understand the game. No more explaining basic metrics—work with clients who respect your expertise.
              </p>
            </div>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <Briefcase size={24} color="#E3C567" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Deal Management</h3>
              <p className="text-[#808080]">
                Manage multiple investment deals in one place. Track pipeline stages, share documents securely, and communicate efficiently.
              </p>
            </div>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-4">
                <Award size={24} color="#E3C567" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">Showcase Your Track Record</h3>
              <p className="text-[#808080]">
                Build your profile with investor-specific credentials, past deals, and specialties. Get matched with investors looking for your exact expertise.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>);

}