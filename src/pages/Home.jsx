import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Shield, MapPin, TrendingUp, Users, ArrowRight, Loader2 } from "lucide-react";

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
  const { loading, user, profile, onboarded, role } = useCurrentProfile();
  const [selectedState, setSelectedState] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const hasRedirected = useRef(false);

  useEffect(() => {
    document.title = "AgentVault - Select Your Market";
  }, []);

  // ONE-TIME redirect logic after loading completes
  useEffect(() => {
    if (loading || hasRedirected.current) return;

    if (user && onboarded) {
      hasRedirected.current = true;
      
      // Redirect onboarded users to their respective dashboards
      if (role === 'investor') {
        navigate(createPageUrl("InvestorHome"), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl("AgentHome"), { replace: true });
      }
    }
  }, [loading, user, onboarded, role, navigate]);

  const handleContinue = () => {
    if (!selectedState) {
      return;
    }

    // Store selected state for later use
    sessionStorage.setItem('selectedState', selectedState.code);
    sessionStorage.setItem('selectedStateName', selectedState.name);

    // Route based on auth/onboarding state
    if (!user) {
      // Not logged in - redirect to login
      base44.auth.redirectToLogin(createPageUrl("RoleSelection"));
    } else if (!profile || !role || role === 'member') {
      // Has auth but no role - go to role selection
      navigate(createPageUrl("RoleSelection"));
    } else if (!onboarded) {
      // Has role but not onboarded - go to appropriate onboarding
      if (role === 'investor') {
        navigate(createPageUrl("InvestorOnboarding"));
      } else if (role === 'agent') {
        navigate(createPageUrl("AgentOnboarding"));
      }
    } else {
      // Fully onboarded - check for existing rooms in this state (lock-in)
      checkExistingRoomsAndRoute();
    }
  };

  const checkExistingRoomsAndRoute = async () => {
    if (role !== 'investor') {
      // Agents don't have lock-in, go to dashboard
      navigate(createPageUrl("AgentHome"));
      return;
    }

    try {
      // Check for existing rooms in this state
      const response = await base44.functions.invoke('inboxList');
      const rooms = response.data || [];
      
      // Find any open room for this state
      const existingRoom = rooms.find(r => 
        r.room && 
        r.room.state === selectedState.code &&
        (!r.room.closedAt)
      );

      if (existingRoom) {
        // Lock-in: send to existing room
        navigate(createPageUrl(`Room/${existingRoom.roomId}`));
      } else {
        // No existing room - proceed to matches
        navigate(createPageUrl("Matches"));
      }
    } catch (error) {
      console.error('Check rooms error:', error);
      // On error, just proceed to matches
      navigate(createPageUrl("Matches"));
    }
  };

  const filteredStates = US_STATES.filter(state =>
    state.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    state.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Main map selection UI (for non-onboarded users)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Where are you looking to invest?
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Select a state to find verified, investor-friendly agents in your target market
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-8">
          <input
            type="text"
            placeholder="Search for a state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-6 py-4 text-lg border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* State Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8 max-h-96 overflow-y-auto p-4 bg-white rounded-xl border-2 border-slate-200">
          {filteredStates.map((state) => (
            <button
              key={state.code}
              onClick={() => setSelectedState(state)}
              className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                selectedState?.code === state.code
                  ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                  : 'border-slate-200 hover:border-blue-300 text-slate-700'
              }`}
            >
              <div className="text-sm font-medium">{state.code}</div>
              <div className="text-xs mt-1">{state.name}</div>
            </button>
          ))}
        </div>

        {/* Selected State Display */}
        {selectedState && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-700 font-medium">Selected Market</p>
                  <p className="text-lg font-bold text-blue-900">{selectedState.name}</p>
                </div>
              </div>
              <Button
                onClick={() => setSelectedState(null)}
                variant="ghost"
                size="sm"
                className="text-blue-700 hover:text-blue-900"
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
            disabled={!selectedState}
            className="bg-blue-600 hover:bg-blue-700 text-lg px-12 h-14"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Verified Agents</h3>
            <p className="text-sm text-slate-600">Licensed & background checked</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Investor-First</h3>
            <p className="text-sm text-slate-600">Agents who protect your interests</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Exclusive Matching</h3>
            <p className="text-sm text-slate-600">One agent per deal for focus</p>
          </div>
        </div>
      </div>
    </div>
  );
}