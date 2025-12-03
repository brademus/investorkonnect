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

  const handleLogin = async () => {
    // If already logged in, go to dashboard
    const isAuth = await base44.auth.isAuthenticated();
    if (isAuth) {
      navigate(createPageUrl("Dashboard"));
    } else {
      base44.auth.redirectToLogin(createPageUrl("PostAuth"));
    }
  };

  const handleGetStarted = async () => {
    // Check if already logged in
    const isAuth = await base44.auth.isAuthenticated();
    if (isAuth) {
      // Already logged in - go to PostAuth to route them properly
      navigate(createPageUrl("PostAuth"));
    } else {
      // Not logged in - go to RoleSelection first
      navigate(createPageUrl("RoleSelection"));
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Fixed Header */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <Logo size="default" showText={true} linkTo="/" />
          <div className="flex items-center gap-3">
            <button 
              onClick={handleLogin} 
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#111827] shadow-sm transition-all hover:border-[#D3A029] hover:shadow-md"
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#F5E6B3] to-[#FAF7F2] rounded-full mb-8">
            <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
            <span className="text-sm font-medium text-[#111827]">
              The #1 Network for Investor-Friendly Agents
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold text-[#111827] mb-6 leading-tight">
            Connect with agents who{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-[#D4AF37]">speak your language</span>
              <span className="absolute inset-x-0 bottom-2 h-4 bg-[#D4AF37] opacity-30 -rotate-1"></span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-[#4B5563] mb-10 max-w-2xl mx-auto">
            Stop wasting time explaining cap rates and BRRRR to residential agents. 
            Find vetted investor-friendly agents in your target market instantly.
          </p>

          {/* CTA Button */}
          <div className="mb-8">
            <Button
              onClick={handleGetStarted}
              className="bg-[#D4AF37] hover:bg-[#B8941F] text-white px-12 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Submit Your First Deal
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#4B5563]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
              <span>Vetted Experience</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
              <span>Market Data Access</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
              <span>Off-Market Deals</span>
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
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#111827] mb-4">
              Why investors choose our network
            </h2>
            <p className="text-lg text-[#4B5563]">
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
                <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-[#D3A029]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#111827] mb-2">{feature.title}</h3>
                  <p className="text-[#4B5563]">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-[#111827]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to find your next deal?
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Join thousands of investors who are scaling their portfolios with the right partners.
          </p>
          <Button
            onClick={handleGetStarted}
            className="bg-[#D3A029] hover:bg-[#B8941F] text-white px-8 py-4 rounded-xl font-medium text-lg"
          >
            Get Started Now
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}