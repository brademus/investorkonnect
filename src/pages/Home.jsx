import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useWizard } from "@/components/WizardContext";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { MapPin, Shield, TrendingUp, Users, Search, Home as HomeIcon, ChevronRight, CheckCircle, Star } from "lucide-react";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }
];

export default function Home() {
  const navigate = useNavigate();
  const { setSelectedState } = useWizard();
  const { loading, user, profile } = useCurrentProfile();
  const [localState, setLocalState] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "Select Your Market - Investor Konnect";
  }, []);

  const filteredStates = US_STATES.filter(state =>
    state.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    state.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContinue = async () => {
    if (!localState) return;
    setSelectedState(localState.code);

    if (user && profile) {
      try {
        await base44.entities.Profile.update(profile.id, {
          target_state: localState.code,
          markets: [localState.code]
        });
      } catch (err) {}
    }

    navigate(createPageUrl("RoleSelection"));
  };

  const handleLogin = () => {
    const callbackUrl = createPageUrl("PostAuth") || createPageUrl("Dashboard") || window.location.pathname;
    base44.auth.redirectToLogin(callbackUrl);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF]" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-[#E5E7EB] px-6 md:px-20 py-4 sticky top-0 z-50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#D4AF37] rounded-[12px] flex items-center justify-center">
              <HomeIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-[20px] font-bold text-[#1A1A1A]">INVESTOR KONNECT</span>
          </div>
          
          <button
            onClick={handleLogin}
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-full px-6 py-2.5 font-medium text-[14px] text-[#1A1A1A] transition-all duration-250"
          >
            Log In
          </button>
        </div>
      </nav>

      {/* Social Proof Banner */}
      <div className="bg-[#F9FAFB] py-3 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-center gap-6 text-[14px]">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#10B981]" />
            <span className="text-[#666666]">Join <strong className="text-[#1A1A1A]">2,500+</strong> investors who trust Investor Konnect</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />)}
            <span className="text-[#666666] ml-2">4.9/5 rating</span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="py-16 md:py-24" style={{ background: 'linear-gradient(135deg, #F5E6C3 0%, #FFFFFF 50%, #F5E6C3 100%)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 text-center">
          <h1 className="text-[32px] md:text-[48px] font-bold text-[#1A1A1A] mb-4 leading-[1.2]" style={{ letterSpacing: '-0.02em' }}>
            Connect with verified{" "}
            <span className="text-[#D4AF37]">investor-friendly agents</span>
          </h1>
          <p className="text-[16px] md:text-[20px] text-[#666666] max-w-3xl mx-auto leading-[1.5]">
            Licensed professionals. Protected deals. Exclusive matching.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-12 md:py-16">
        
        {/* Search Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-white rounded-[24px] p-8 md:p-12 border border-[#E5E7EB]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#F5E6C3] rounded-[20px] mb-4">
                <MapPin className="w-9 h-9 text-[#D4AF37]" />
              </div>
              <h2 className="text-[24px] md:text-[32px] font-bold text-[#1A1A1A] mb-3 leading-[1.2]">
                Where are you investing?
              </h2>
              <p className="text-[16px] text-[#666666] leading-[1.5]">
                Select your target market to find the perfect agent match
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="bg-white rounded-full px-6 py-3 border border-[#E5E7EB] transition-all duration-250 hover:border-[#999999]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-[#999999] flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search for a state..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 outline-none text-[16px] text-[#1A1A1A] placeholder-[#999999] bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* State Grid */}
            <div className="bg-[#F9FAFB] rounded-[20px] p-6 mb-6 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredStates.map((state) => (
                  <button
                    key={state.code}
                    onClick={() => setLocalState(state)}
                    className={`p-4 rounded-[12px] border-2 transition-all duration-250 hover:-translate-y-1 ${
                      localState?.code === state.code
                        ? 'border-[#D4AF37] bg-[#F5E6C3]'
                        : 'border-[#E5E7EB] hover:border-[#D4AF37] bg-white'
                    }`}
                    style={{ boxShadow: localState?.code === state.code ? '0 4px 12px rgba(212,175,55,0.25)' : '0 2px 8px rgba(0,0,0,0.06)' }}
                  >
                    <div className={`text-[16px] font-bold ${
                      localState?.code === state.code ? 'text-[#B8941F]' : 'text-[#1A1A1A]'
                    }`}>
                      {state.code}
                    </div>
                    <div className="text-[12px] mt-1 text-[#666666]">{state.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected State */}
            {localState && (
              <div className="bg-[#F5E6C3] border-2 border-[#D4AF37] rounded-[20px] p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#D4AF37] rounded-[16px] flex items-center justify-center">
                      <MapPin className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-[12px] text-[#B8941F] font-medium mb-1">Selected Market</p>
                      <p className="text-[20px] font-bold text-[#1A1A1A]">{localState.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLocalState(null)}
                    className="text-[#B8941F] hover:bg-[#D4AF37]/20 rounded-[8px] px-4 py-2 font-medium text-[14px] transition-colors"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            {/* Continue Button */}
            <div className="text-center">
              <button
                onClick={handleContinue}
                disabled={!localState}
                className="bg-[#D4AF37] hover:bg-[#B8941F] text-white text-[16px] px-12 py-4 rounded-[12px] font-semibold transition-all duration-250 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] flex items-center gap-2 mx-auto"
                style={{ boxShadow: localState ? '0 4px 12px rgba(212,175,55,0.4)' : 'none' }}
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="max-w-5xl mx-auto">
          <h3 className="text-[24px] font-bold text-[#1A1A1A] text-center mb-10 leading-[1.2]">
            Why Investor Konnect?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Verified Agents", desc: "Every agent is licensed, background checked, and vetted for investor experience", color: "#10B981", bg: "#10B981" },
              { icon: TrendingUp, title: "Investor-First", desc: "Agents who understand investment strategies and protect your financial interests", color: "#D4AF37", bg: "#D4AF37" },
              { icon: Users, title: "Exclusive Matching", desc: "One agent per deal ensures focused attention and dedicated service", color: "#3B82F6", bg: "#3B82F6" }
            ].map((item, idx) => (
              <div 
                key={idx} 
                className="bg-white rounded-[20px] border border-[#E5E7EB] p-8 text-center transition-all duration-250 hover:-translate-y-1 cursor-pointer"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-4" style={{ backgroundColor: `${item.bg}20` }}>
                  <item.icon className="w-8 h-8" style={{ color: item.color }} />
                </div>
                <h3 className="text-[20px] font-bold text-[#1A1A1A] mb-3 leading-[1.3]">{item.title}</h3>
                <p className="text-[14px] text-[#666666] leading-[1.5]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center text-[#999999] text-[14px]">
          <p>© 2024 Investor Konnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}