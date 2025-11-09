import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useWizard } from "@/components/WizardContext";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { MapPin, Shield, TrendingUp, Users, Search } from "lucide-react";

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

/**
 * STEP 1: MAP SELECTION
 * 
 * First thing anyone sees. No auth required.
 * Choose target market/state, then continue to role selection.
 * 
 * Login button routes to RoleSelection which handles onboarding status.
 */
export default function Home() {
  const navigate = useNavigate();
  const { setSelectedState } = useWizard();
  const { loading, user, profile } = useCurrentProfile();
  const [localState, setLocalState] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "Select Your Market - AgentVault";
  }, []);

  const filteredStates = US_STATES.filter(state =>
    state.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    state.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContinue = async () => {
    if (!localState) return;

    // Save to wizard context
    setSelectedState(localState.code);

    // If user is logged in, also save to profile
    if (user && profile) {
      try {
        await base44.entities.Profile.update(profile.id, {
          target_state: localState.code,
          markets: [localState.code]
        });
      } catch (err) {
        console.warn('[Home] Could not update profile with state:', err);
      }
    }

    // Continue to role selection
    navigate(createPageUrl("RoleSelection"));
  };

  const handleLogin = () => {
    // Redirect to login, callback to RoleSelection which will check onboarding status
    const callbackUrl = createPageUrl("RoleSelection") || window.location.pathname;
    base44.auth.redirectToLogin(callbackUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      {/* NO TOP NAV - Wizard flow only */}
      
      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        
        {/* Login button for existing users */}
        <div className="flex justify-end mb-8">
          <Button
            variant="outline"
            onClick={handleLogin}
            className="gap-2 border-slate-300 hover:bg-slate-50"
          >
            Log In
          </Button>
        </div>

        {/* Logo */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            AgentVault
          </h1>
          <p className="text-xl text-slate-600">
            Verified agents. Protected deals.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-200 p-8 md:p-12">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              Where are you looking to invest?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Select your target market to find verified, investor-friendly agents
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search for a state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          {/* State Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8 max-h-96 overflow-y-auto p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
            {filteredStates.map((state) => (
              <button
                key={state.code}
                onClick={() => setLocalState(state)}
                className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
                  localState?.code === state.code
                    ? 'border-blue-600 bg-blue-50 shadow-md scale-105'
                    : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div className={`text-lg font-bold ${
                  localState?.code === state.code ? 'text-blue-900' : 'text-slate-700'
                }`}>
                  {state.code}
                </div>
                <div className="text-xs mt-1 text-slate-600">{state.name}</div>
              </button>
            ))}
          </div>

          {/* Selected State Display */}
          {localState && (
            <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 font-semibold">Selected Market</p>
                    <p className="text-2xl font-bold text-blue-900">{localState.name}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setLocalState(null)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                >
                  Change
                </Button>
              </div>
            </div>
          )}

          {/* Continue Button */}
          <div className="text-center">
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={!localState}
              className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white text-lg px-12 py-6 h-auto rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Next Step
            </Button>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="text-center bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Verified Agents</h3>
            <p className="text-sm text-slate-600">Licensed & background checked</p>
          </div>
          <div className="text-center bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Investor-First</h3>
            <p className="text-sm text-slate-600">Agents who protect your interests</p>
          </div>
          <div className="text-center bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">Exclusive Matching</h3>
            <p className="text-sm text-slate-600">One agent per deal for focus</p>
          </div>
        </div>
      </div>
    </div>
  );
}