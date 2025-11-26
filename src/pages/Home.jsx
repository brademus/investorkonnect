import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useWizard } from "@/components/WizardContext";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { MapPin, Shield, TrendingUp, Users, Search, Home as HomeIcon } from "lucide-react";

// US States for map selection
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
      } catch (err) {
        // Continue anyway
      }
    }

    navigate(createPageUrl("RoleSelection"));
  };

  const handleLogin = () => {
    const callbackUrl = createPageUrl("PostAuth") || createPageUrl("Dashboard") || window.location.pathname;
    base44.auth.redirectToLogin(callbackUrl);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="navbar px-6 md:px-20 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center">
              <HomeIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-700">INVESTOR KONNECT</span>
          </div>
          
          <Button
            variant="outline"
            onClick={handleLogin}
            className="border-gray-300 hover:bg-gray-50 rounded-full px-6 font-medium"
          >
            Log In
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gold-gradient py-16 md:py-24">
        <div className="container-airbnb text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
            Connect with verified{" "}
            <span className="text-gold-600">investor-friendly agents</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
            Licensed professionals. Protected deals. Exclusive matching.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-airbnb py-12 md:py-16">
        
        {/* Search Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 md:p-12">
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-100 rounded-2xl mb-4">
                <MapPin className="w-9 h-9 text-gold-600" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
                Where are you investing?
              </h2>
              <p className="text-lg text-gray-600">
                Select your target market to find the perfect agent match
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="search-bar">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search for a state..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 outline-none text-base text-gray-700 placeholder-gray-400 bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* State Grid */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-6 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredStates.map((state) => (
                  <button
                    key={state.code}
                    onClick={() => setLocalState(state)}
                    className={`p-4 rounded-xl border-2 transition-all hover:-translate-y-1 hover:shadow-md ${
                      localState?.code === state.code
                        ? 'border-gold-500 bg-gold-50 shadow-md'
                        : 'border-gray-200 hover:border-gold-300 bg-white'
                    }`}
                  >
                    <div className={`text-lg font-bold ${
                      localState?.code === state.code ? 'text-gold-700' : 'text-gray-700'
                    }`}>
                      {state.code}
                    </div>
                    <div className="text-xs mt-1 text-gray-500">{state.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected State */}
            {localState && (
              <div className="bg-gold-50 border-2 border-gold-200 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gold-500 rounded-xl flex items-center justify-center">
                      <MapPin className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gold-700 font-semibold mb-1">Selected Market</p>
                      <p className="text-2xl font-bold text-gray-800">{localState.name}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setLocalState(null)}
                    variant="ghost"
                    className="text-gold-700 hover:bg-gold-100 rounded-xl"
                  >
                    Change
                  </Button>
                </div>
              </div>
            )}

            {/* Continue Button */}
            <div className="text-center">
              <Button
                onClick={handleContinue}
                disabled={!localState}
                className="btn-gold text-lg px-12 py-6 h-auto disabled:opacity-50"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="max-w-5xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-10">
            Why Investor Konnect?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="listing-card p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-4">
                <Shield className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Verified Agents</h3>
              <p className="text-gray-600 leading-relaxed">
                Every agent is licensed, background checked, and vetted for investor experience
              </p>
            </div>
            
            <div className="listing-card p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-100 rounded-2xl mb-4">
                <TrendingUp className="w-8 h-8 text-gold-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Investor-First</h3>
              <p className="text-gray-600 leading-relaxed">
                Agents who understand investment strategies and protect your financial interests
              </p>
            </div>
            
            <div className="listing-card p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">Exclusive Matching</h3>
              <p className="text-gray-600 leading-relaxed">
                One agent per deal ensures focused attention and dedicated service
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 mt-16">
        <div className="container-airbnb text-center text-gray-500 text-sm">
          <p>© 2024 Investor Konnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}