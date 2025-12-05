import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { 
  Shield, MapPin, FileText, Users, Building2, Star, 
  CheckCircle, ArrowRight
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { loading, user, profile } = useCurrentProfile();

  const handleLogin = () => {
    // Always go through PostAuth - it handles all routing
    base44.auth.redirectToLogin(createPageUrl("PostAuth"));
  };

  const handleGetStarted = () => {
    // Always go through PostAuth - it handles all routing
    base44.auth.redirectToLogin(createPageUrl("PostAuth"));
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Fixed Header */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#333333] bg-[#0F0F0F]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <Logo size="default" showText={true} linkTo="/" />
          <div className="flex items-center gap-3">
            <button 
              onClick={handleLogin} 
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#333333] bg-[#1A1A1A] px-5 py-2.5 text-sm font-medium text-[#FAFAFA] shadow-sm transition-all hover:border-[#E5C37F] hover:bg-[#262626]"
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E5C37F]/20 to-[#D4AF37]/10 border border-[#E5C37F]/30 rounded-full mb-8">
            <div className="w-2 h-2 rounded-full bg-[#E5C37F]" />
            <span className="text-sm font-medium text-[#E5C37F]">
              The #1 Network for Investor-Friendly Agents
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-light text-[#FAFAFA] mb-6 leading-tight tracking-wide">
            Connect with agents who{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-[#E5C37F]">speak your language</span>
              <span className="absolute inset-x-0 bottom-2 h-4 bg-[#E5C37F] opacity-30 -rotate-1"></span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-[#A6A6A6] mb-10 max-w-2xl mx-auto">
            Stop wasting time explaining cap rates and BRRRR to residential agents. 
            Find vetted investor-friendly agents in your target market instantly.
          </p>

          {/* CTA Button */}
          <div className="mb-8">
            <Button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-[#E5C37F] to-[#C9A961] hover:from-[#F0D699] hover:to-[#D4AF37] text-[#0F0F0F] px-12 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-[0_8px_20px_rgba(229,195,127,0.4)] transition-all"
            >
              Submit Your First Deal
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#A6A6A6]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#E5C37F]" />
              <span>Vetted Experience</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#E5C37F]" />
              <span>Market Data Access</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#E5C37F]" />
              <span>Off-Market Deals</span>
            </div>
          </div>

          {/* Video Section */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#333333]">
              <iframe 
                src="https://drive.google.com/file/d/1TZXb6W9V5_vVITTIxt7tEXLtoFarKzAf/preview" 
                className="w-full aspect-video"
                allow="autoplay"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* Visual Proof Section */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Institutional Grade - Building image */}
            <div className="relative h-64 rounded-3xl overflow-hidden">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/c287eab81_hero-office.jpg" 
                alt="Institutional Grade"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
              <div className="absolute bottom-6 left-6 text-white">
                <h3 className="text-2xl font-bold mb-1">Institutional Grade</h3>
                <p className="text-sm text-white/90">Access partners used by top firms</p>
              </div>
            </div>

            {/* Trusted Network - Handshake image */}
            <div className="relative h-64 rounded-3xl overflow-hidden">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/971d5cd2d_handshake.jpg" 
                alt="Trusted Network"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
              <div className="absolute bottom-6 left-6 text-white">
                <h3 className="text-2xl font-bold mb-1">Trusted Network</h3>
                <p className="text-sm text-white/90">Verified track records only</p>
              </div>
            </div>

            {/* Data Driven - Blueprints image */}
            <div className="relative h-64 rounded-3xl overflow-hidden">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/17f0e3058_blueprints.jpg" 
                alt="Data Driven"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/20" />
              <div className="absolute bottom-6 left-6 text-white">
                <h3 className="text-2xl font-bold mb-1">Data Driven</h3>
                <p className="text-sm text-white/90">Make decisions based on facts</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Section */}
      <section className="py-16 px-4 bg-[#0F0F0F]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-light text-[#E5C37F] mb-4 tracking-wide">
              Why investors choose our network
            </h2>
            <p className="text-lg text-[#A6A6A6] font-light tracking-wide">
              We've built the ecosystem you need to scale your portfolio efficiently.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                icon: Shield, 
                title: "Vetted Agents Only", 
                desc: "Every agent is interviewed and verified for investment experience." 
              },
              { 
                icon: MapPin, 
                title: "Local Market Experts", 
                desc: "Partners who know the neighborhoods, rents, and regulations." 
              },
              { 
                icon: FileText, 
                title: "Deal Flow Access", 
                desc: "Get access to off-market and pocket listings before they hit the MLS." 
              },
              { 
                icon: Users, 
                title: "Contractor Network", 
                desc: "Tap into trusted vendor lists for renovations and repairs." 
              },
              { 
                icon: Building2, 
                title: "Property Management", 
                desc: "Seamless handoff to reliable property management partners." 
              },
              { 
                icon: Star, 
                title: "Performance Rated", 
                desc: "Agents are rated by other investors on actual deal performance." 
              }
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="bg-[#1A1A1A] border border-[#333333] rounded-2xl p-6 hover:shadow-[0_10px_25px_rgba(229,195,127,0.2)] hover:border-[#E5C37F] transition-all">
                  <div className="w-12 h-12 bg-[#E5C37F]/15 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#E5C37F]" />
                  </div>
                  <h3 className="text-xl font-light text-[#FAFAFA] mb-2 tracking-wide">{feature.title}</h3>
                  <p className="text-[#A6A6A6] font-light tracking-wide">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-light text-[#E5C37F] mb-4 tracking-wide">
            Ready to find your next deal?
          </h2>
          <p className="text-lg text-[#A6A6A6] mb-8 font-light tracking-wide">
            Join thousands of investors who are scaling their portfolios with the right partners.
          </p>
          <Button
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-[#E5C37F] to-[#C9A961] hover:from-[#F0D699] hover:to-[#D4AF37] text-[#0F0F0F] px-8 py-4 rounded-full font-semibold text-lg shadow-lg hover:shadow-[0_8px_20px_rgba(229,195,127,0.4)] transition-all"
          >
            Get Started Now
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}