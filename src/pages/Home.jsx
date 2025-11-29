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
    <div className="ik-shell">
      {/* Top nav - fixed, minimal, Airbnb-like */}
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:max-w-7xl lg:px-8">
          {/* Left: logo + brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FDE68A]">
              <span className="text-xs font-bold tracking-tight text-[#D3A029]">IK</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-[#111827]">
              Investor Konnect
            </span>
          </div>

          {/* Center nav – simple, small text links */}
          <nav className="hidden items-center gap-6 text-xs font-medium text-[#4B5563] md:flex">
            <Link to={createPageUrl("Home")} className="hover:text-[#111827]">Home</Link>
            <Link to={createPageUrl("HowItWorks")} className="hover:text-[#111827]">How it works</Link>
            <Link to={createPageUrl("Pricing")} className="hover:text-[#111827]">Pricing</Link>
            <Link to={createPageUrl("Investors")} className="hover:text-[#111827]">For investors</Link>
            <Link to={createPageUrl("Agents")} className="hover:text-[#111827]">For agents</Link>
          </nav>

          {/* Right: Auth */}
          <div className="flex items-center gap-2">
            <button onClick={handleLogin} className="ik-btn-outline text-xs">
              Log in
            </button>
          </div>
        </div>
      </header>

      {/* Page content – centered, offset for fixed header */}
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:max-w-7xl lg:px-8 lg:pt-24">
        <div className="space-y-10 lg:space-y-12">
          {/* HERO STRIP */}
          <section className="space-y-4 text-center sm:text-left">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[0.7rem] font-medium text-[#6B7280] shadow-sm sm:mx-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D3A029]" />
              Verified investor-friendly agents
            </p>

            <div className="mx-auto max-w-3xl sm:mx-0">
              <h1 className="text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl lg:text-[2.7rem]">
                Stop training retail agents.
                <br />
                <span className="text-[#D3A029]">Start closing investor deals.</span>
              </h1>
              <p className="mt-3 text-sm text-[#4B5563] sm:text-base">
                Investor Konnect matches your strategy and market with agents who already know
                how to work with real estate investors, then keeps everything in one shared
                deal room.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <button
                type="button"
                onClick={handleContinue}
                disabled={!localState}
                className="ik-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit your first deal
              </button>
              <Link to={createPageUrl("Investors")}>
                <button className="ik-btn-outline">For investors</button>
              </Link>
              <Link to={createPageUrl("Agents")}>
                <button className="ik-btn-outline">For agents</button>
              </Link>
            </div>
          </section>

          {/* BIG MAP / STATE SELECTOR */}
          <section className="ik-card border border-[#E5E7EB]">
            {/* top row */}
            <div className="flex flex-col gap-4 border-b border-[#F3F4F6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FEF3C7]">
                  <MapPin className="w-5 h-5 text-[#D3A029]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Where are you looking to invest?
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Choose a state to see investor-friendly agents in that market.
                  </p>
                </div>
              </div>
              {localState && (
                <span className="ik-chip text-xs">
                  Selected: {localState.code}
                </span>
              )}
            </div>

            {/* search + grid area */}
            <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6">
              {/* LEFT: decorative map area */}
              <div className="relative overflow-hidden rounded-2xl bg-[#F9FAFB]">
                <div className="flex h-[260px] items-center justify-center sm:h-[300px] lg:h-[340px]">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF3C7]">
                      <MapPin className="h-8 w-8 text-[#D3A029]" />
                    </div>
                    <p className="text-sm font-medium text-[#111827]">
                      {localState ? localState.name : "Select a state"}
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {localState ? "Ready to find agents" : "Pick from the list →"}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT: state search and grid */}
              <div className="flex flex-col">
                {/* Search bar */}
                <div className="mb-3 flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2">
                  <Search className="h-4 w-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search for a state…"
                    className="flex-1 border-none bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
                  />
                </div>

                {/* Grid of states */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid max-h-[260px] grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {filteredStates.map((state) => (
                      <button
                        key={state.code}
                        type="button"
                        onClick={() => setLocalState(state)}
                        className={
                          "flex flex-col rounded-2xl border px-3 py-2 text-left text-[0.75rem] transition " +
                          (localState?.code === state.code
                            ? "border-[#D3A029] bg-[#FFFBEB] text-[#111827]"
                            : "border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#D3A029]/80 hover:bg-white")
                        }
                      >
                        <span className="text-[0.8rem] font-semibold">
                          {state.code}
                        </span>
                        <span className="mt-0.5 text-[0.7rem] text-[#6B7280]">
                          {state.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[#F3F4F6] px-4 py-3 text-xs text-[#6B7280] sm:flex-row sm:px-6">
              <p>You can change your market later from your dashboard.</p>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!localState}
                className="ik-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
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