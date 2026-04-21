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
import VideoWithPoster from "@/components/VideoWithPoster";

export default function InvestorLanding() {
  const navigate = useNavigate();

  const handleLogin = () => {
    const target = createPageUrl("PostAuth") + "?selectedRole=investor";
    base44.auth.redirectToLogin(target);
  };

  const handleGetStarted = async () => {
    // If already logged in, route internally; otherwise go to login
    const isAuth = await base44.auth.isAuthenticated();
    const target = createPageUrl("PostAuth") + "?selectedRole=investor";
    if (isAuth) {
      navigate(target);
    } else {
      base44.auth.redirectToLogin(target);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header — compressed on mobile */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#1F1F1F] bg-[#0D0D0D]/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 md:h-16 max-w-6xl items-center justify-between px-3 md:px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => navigate(createPageUrl("RoleLanding"))}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[#808080] hover:text-[#E3C567] active:bg-[#1F1F1F] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Logo size="default" showText={true} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogin}
              className="inline-flex items-center justify-center gap-2 rounded-lg md:rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] px-3 md:px-5 py-2 md:py-2.5 text-xs md:text-sm font-medium text-[#FAFAFA] shadow-sm transition-all hover:border-[#E3C567] hover:bg-[#141414]"
            >
              Log in
            </button>
          </div>
        </div>
      </header>

      {/* Hero — fits on one mobile screen */}
      <section className="pt-16 md:pt-32 pb-8 md:pb-16 px-4 min-h-[calc(100vh-48px)] md:min-h-0 flex flex-col justify-center md:block">
        <div className="max-w-4xl mx-auto text-center w-full">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-[#E3C567]/20 border border-[#E3C567]/30 rounded-full mb-4 md:mb-8">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#E3C567]" />
            <span className="text-xs md:text-sm font-medium text-[#E3C567]">
              For Real Estate Investors
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[26px] leading-[1.15] md:text-5xl md:leading-tight lg:text-6xl font-light text-[#FAFAFA] mb-3 md:mb-6 tracking-wide px-2">
            Work with investor-ready agents in your market.
          </h1>

          {/* Subheadline */}
          <p className="text-sm md:text-lg text-[#808080] mb-5 md:mb-10 max-w-2xl mx-auto px-2">
            Upload a contract, verify key terms, and lock in with the right agent—fast.
          </p>

          {/* CTA Button */}
          <div className="mb-4 md:mb-8">
            <Button
              onClick={handleGetStarted}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black px-8 md:px-12 py-3 md:py-4 rounded-full font-semibold text-base md:text-lg shadow-lg hover:shadow-[0_8px_20px_rgba(227,197,103,0.4)] transition-all"
            >
              Build Investor Profile
            </Button>
          </div>

          {/* Feature badges — visible on mobile, compact */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs md:text-sm text-[#808080] mb-4 md:hidden">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#E3C567]" />
              <span>Verified contracts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#E3C567]" />
              <span>DocuSign lock-in</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#E3C567]" />
              <span>Deal board</span>
            </div>
          </div>

          {/* Privacy — desktop full, mobile compact */}
          <div className="hidden md:flex flex-col items-center gap-1.5 text-sm text-[#808080]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#808080]" />
              <span>Personal information used to build profile only</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#808080]" />
              <span>Information is not shared</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#808080]" />
              <a href="/Privacy" className="underline hover:text-[#E3C567] transition-colors">Privacy Policy</a>
            </div>
            <p className="mt-2 text-xs text-[#555555]">Please use your company email address to sign up</p>
          </div>

          <div className="md:hidden text-[10px] text-[#555555] mt-2">
            Use company email · <a href="/Privacy" className="underline hover:text-[#E3C567]">Privacy</a>
          </div>

          {/* Scroll-for-more hint on mobile only */}
          <div className="md:hidden mt-6 flex flex-col items-center gap-1 text-[10px] text-[#555555] animate-pulse">
            <span>See more below</span>
            <span className="text-base leading-none">↓</span>
          </div>

          {/* Video — desktop only above fold */}
          <div className="hidden md:block mt-16 max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#1F1F1F]">
              <VideoWithPoster src="https://dl.dropboxusercontent.com/scl/fi/5nkej365moh8mpxvzegoa/0224-1.mov?rlkey=gtjon9b8isp2mrwr7rlhjq8h1&st=5ybwr0a4" />
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-[#808080] mt-8">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#E3C567]" />
                <span>Verified contracts & clean deal rooms</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#E3C567]" />
                <span>DocuSign lock-in with gated info</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#E3C567]" />
                <span>Deal board for documents + milestones</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile-only video section */}
      <section className="md:hidden px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#1F1F1F]">
            <VideoWithPoster src="https://dl.dropboxusercontent.com/scl/fi/5nkej365moh8mpxvzegoa/0224-1.mov?rlkey=gtjon9b8isp2mrwr7rlhjq8h1&st=5ybwr0a4" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 md:py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl md:text-3xl font-bold text-[#FAFAFA] text-center mb-6 md:mb-12">
            Everything you need to run deals end-to-end.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div className="rounded-[16px] p-4 md:p-6 backdrop-blur-sm" style={{ background: 'linear-gradient(180deg, rgba(23,23,27,0.92) 0%, rgba(17,17,20,0.96) 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-3 md:mb-4">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-base md:text-xl font-bold text-[#FAFAFA] mb-2 md:mb-3">Investor-Ready Agents</h3>
              <p className="text-sm md:text-base text-[#808080]">
                Match with agents who understand investment deals and can move quickly in your target market.
              </p>
            </div>
            <div className="rounded-[16px] p-4 md:p-6 backdrop-blur-sm" style={{ background: 'linear-gradient(180deg, rgba(23,23,27,0.92) 0%, rgba(17,17,20,0.96) 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-3 md:mb-4">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-base md:text-xl font-bold text-[#FAFAFA] mb-2 md:mb-3">Deal Board + File Hub</h3>
              <p className="text-sm md:text-base text-[#808080]">
                Keep contracts, signed agreements, and deal updates organized in one place—no messy email threads.
              </p>
            </div>
            <div className="rounded-[16px] p-4 md:p-6 backdrop-blur-sm" style={{ background: 'linear-gradient(180deg, rgba(23,23,27,0.92) 0%, rgba(17,17,20,0.96) 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#E3C567]/10 rounded-full flex items-center justify-center mb-3 md:mb-4">
                <MapPin className="w-5 h-5 md:w-6 md:h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-base md:text-xl font-bold text-[#FAFAFA] mb-2 md:mb-3">Protected Until Lock-In</h3>
              <p className="text-sm md:text-base text-[#808080]">
                Sensitive details stay gated until both parties sign the internal agreement—then everything unlocks.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LegalFooterLinks />
    </div>
  );
}