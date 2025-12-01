import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useWizard } from "@/components/WizardContext";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { MapPin, Shield, CheckCircle, Search, Home as HomeIcon, ChevronRight } from "lucide-react";

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
    document.title = "Investor Konnect – Connect with investor-friendly agents";
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
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Top nav - fixed, minimal, Airbnb-like */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-18 sm:px-6 lg:max-w-7xl lg:px-8">
          {/* Left: logo + brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FDE68A] shadow-sm">
              <span className="text-sm font-bold tracking-tight text-[#D3A029]">IK</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-[#111827]">
              Investor Konnect
            </span>
          </div>

          {/* Center nav – removed for cleaner homepage header */}
          {/* <nav className="hidden items-center gap-8 text-sm font-medium text-[#4B5563] md:flex">
            <Link to={createPageUrl("Home")} className="hover:text-[#D3A029] transition-colors">Home</Link>
            <Link to={createPageUrl("HowItWorks")} className="hover:text-[#D3A029] transition-colors">How it works</Link>
            <Link to={createPageUrl("Pricing")} className="hover:text-[#D3A029] transition-colors">Pricing</Link>
            <Link to={createPageUrl("Investors")} className="hover:text-[#D3A029] transition-colors">For investors</Link>
            <Link to={createPageUrl("Agents")} className="hover:text-[#D3A029] transition-colors">For agents</Link>
          </nav> */}

          {/* Right: Auth */}
          <div className="flex items-center gap-3">
            <button 
              onClick={handleLogin} 
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-medium text-[#111827] shadow-sm transition-all hover:border-[#D3A029] hover:shadow-md hover:-translate-y-0.5"
            >
              Log in
            </button>
          </div>
        </div>
      </header>

      {/* Page content – centered, offset for fixed header */}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:max-w-7xl lg:px-8 lg:pt-28">
        <div className="space-y-12 lg:space-y-16">
          {/* HERO STRIP */}
          <section className="space-y-6 text-center sm:text-left">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#6B7280] shadow-md border border-[#E5E7EB] sm:mx-0">
              <span className="h-2 w-2 rounded-full bg-[#D3A029] animate-pulse" />
              Verified investor-friendly agents
            </p>

            <div className="mx-auto max-w-3xl sm:mx-0">
              <h1 className="text-4xl font-bold tracking-tight text-[#111827] sm:text-5xl lg:text-6xl leading-tight">
                Stop training retail agents.
                <br />
                <span className="text-[#D3A029]">Start closing investor deals.</span>
              </h1>
              <p className="mt-6 text-lg text-[#4B5563] sm:text-xl leading-relaxed">
                Investor Konnect matches your strategy and market with agents who already know
                how to work with real estate investors, then keeps everything in one shared
                deal room.
              </p>
            </div>

          </section>

          {/* BIG MAP / STATE SELECTOR */}
          <section className="rounded-3xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden">
            {/* top row */}
            <div className="flex flex-col gap-4 border-b border-[#F3F4F6] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF3C7] shadow-sm">
                  <MapPin className="w-6 h-6 text-[#D3A029]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">
                    Where are you looking to invest?
                  </h2>
                  <p className="text-sm text-[#6B7280] mt-1">
                    Choose a state to see investor-friendly agents in that market.
                  </p>
                </div>
              </div>
              {localState && (
                <span className="inline-flex items-center rounded-full border border-[#D3A029] bg-[#FFFBEB] px-4 py-2 text-sm font-medium text-[#92400E]">
                  ✓ Selected: {localState.name}
                </span>
              )}
            </div>

            {/* search + grid area */}
            <div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
              {/* LEFT: decorative map area */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FEF3C7] to-[#FFFBEB] border border-[#FDE68A]">
                <div className="flex h-[280px] items-center justify-center sm:h-[320px] lg:h-[360px]">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
                      <MapPin className="h-10 w-10 text-[#D3A029]" />
                    </div>
                    <p className="text-xl font-semibold text-[#111827]">
                      {localState ? localState.name : "Select a state"}
                    </p>
                    <p className="mt-2 text-sm text-[#6B7280]">
                      {localState ? "Ready to find agents" : "Pick from the list →"}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT: state search and grid */}
              <div className="flex flex-col">
                {/* Search bar */}
                <div className="mb-4 flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 shadow-sm focus-within:border-[#D3A029] focus-within:ring-2 focus-within:ring-[#D3A029]/20 transition-all">
                  <Search className="h-5 w-5 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search for a state…"
                    className="flex-1 border-none bg-transparent text-base text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
                  />
                </div>

                {/* Grid of states */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid max-h-[280px] grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {filteredStates.map((state) => (
                      <button
                        key={state.code}
                        type="button"
                        onClick={() => setLocalState(state)}
                        className={
                          "flex flex-col rounded-xl border-2 px-3 py-3 text-left transition-all duration-200 " +
                          (localState?.code === state.code
                            ? "border-[#D3A029] bg-[#FFFBEB] text-[#111827] shadow-md ring-2 ring-[#D3A029]/20"
                            : "border-[#E5E7EB] bg-white hover:border-[#D3A029] hover:bg-[#FFFBEB] hover:shadow-sm")
                        }
                      >
                        <span className="text-base font-bold text-[#111827]">
                          {state.code}
                        </span>
                        <span className="mt-0.5 text-sm text-[#6B7280]">
                          {state.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="flex flex-col items-center justify-between gap-4 border-t border-[#F3F4F6] bg-[#F9FAFB] px-6 py-5 sm:flex-row sm:px-8">
              <p className="text-sm text-[#6B7280]">You can change your market later from your dashboard.</p>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!localState}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Continue →
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}