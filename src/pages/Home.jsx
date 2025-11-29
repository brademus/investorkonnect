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
      {/* Public navbar */}
      <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: logo + brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FDE68A]">
              <span className="text-sm font-bold text-[#D3A029]">IK</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Investor Konnect
            </span>
          </div>

          {/* Center: simple nav */}
          <nav className="hidden gap-6 text-xs font-medium text-[#4B5563] md:flex">
            <Link to={createPageUrl("Home")} className="hover:text-[#111827]">Home</Link>
            <Link to={createPageUrl("HowItWorks")} className="hover:text-[#111827]">How it works</Link>
            <Link to={createPageUrl("Pricing")} className="hover:text-[#111827]">Pricing</Link>
            <Link to={createPageUrl("Investors")} className="hover:text-[#111827]">For investors</Link>
            <Link to={createPageUrl("Agents")} className="hover:text-[#111827]">For agents</Link>
          </nav>

          {/* Right: auth */}
          <div className="flex items-center gap-2">
            <button onClick={handleLogin} className="ik-btn-outline text-xs">
              Log in
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 lg:px-8 py-8 lg:py-10">
        <div className="space-y-10 lg:space-y-14">
          {/* HERO + MAP SECTION */}
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.1fr)] lg:items-start">
            {/* LEFT: hero content */}
            <div className="space-y-5">
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-[#6B7280] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D3A029]" />
                Built for real estate investors
              </p>

              <h1 className="text-4xl font-semibold tracking-tight text-[#111827] sm:text-5xl lg:text-[2.9rem]">
                Stop training retail agents.
                <br />
                <span className="text-[#D3A029]">Start closing investor deals.</span>
              </h1>

              <p className="max-w-xl text-sm text-[#4B5563] sm:text-base">
                Investor Konnect matches your strategy and market with agents who already
                know how to work with real estate investors — then keeps everything in one
                shared deal room.
              </p>

              <div className="flex flex-wrap gap-3">
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

              <ul className="mt-4 space-y-1.5 text-sm text-[#4B5563]">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#D3A029]" />
                  Vetted agents with investor track records
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#D3A029]" />
                  Shared deal rooms with chat & milestones
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#D3A029]" />
                  Contracts pre-filled from your conversation
                </li>
              </ul>
            </div>

            {/* RIGHT: BIG "MAP" CARD */}
            <div className="w-full">
              <div className="ik-card h-full max-h-[560px] overflow-hidden border border-[#E5E7EB] bg-white">
                {/* header */}
                <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF3C7]">
                      <MapPin className="w-5 h-5 text-[#D3A029]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-[#111827]">
                        Where are you looking to invest?
                      </h2>
                      <p className="text-xs text-[#6B7280]">
                        Pick your target state to see investor-friendly agents.
                      </p>
                    </div>
                  </div>

                  {localState && (
                    <span className="ik-chip text-xs">
                      Selected: {localState.code}
                    </span>
                  )}
                </div>

                {/* search bar */}
                <div className="flex items-center gap-2 border-b border-[#F3F4F6] px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6]">
                    <Search className="w-4 h-4 text-[#6B7280]" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search for a state…"
                    className="flex-1 border-none bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
                  />
                </div>

                {/* big grid "map" */}
                <div className="h-[320px] overflow-y-auto px-5 py-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {filteredStates.map((state) => (
                      <button
                        key={state.code}
                        type="button"
                        onClick={() => setLocalState(state)}
                        className={
                          "flex flex-col rounded-2xl border px-3 py-2 text-left text-xs transition " +
                          (localState?.code === state.code
                            ? "border-[#D3A029] bg-[#FFFBEB] text-[#111827]"
                            : "border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#D3A029]/70 hover:bg-white")
                        }
                      >
                        <span className="text-[0.8rem] font-semibold">
                          {state.code}
                        </span>
                        <span className="text-[0.7rem] text-[#6B7280]">
                          {state.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* footer with continue button */}
                <div className="flex items-center justify-between border-t border-[#F3F4F6] px-5 py-3">
                  <p className="hidden text-[0.7rem] text-[#6B7280] sm:block">
                    You can change markets later from your dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!localState}
                    className="ik-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Secondary section: 3-column "why Investor Konnect" cards */}
          <section className="hidden gap-4 text-sm text-[#4B5563] lg:grid lg:grid-cols-3">
            <div className="ik-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-[#111827]">
                Built for investors
              </h3>
              <p>Agents are vetted for investor experience, not just retail deals.</p>
            </div>
            <div className="ik-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-[#111827]">
                One shared deal room
              </h3>
              <p>Chat, milestones, documents, and contracts all live in one place.</p>
            </div>
            <div className="ik-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-[#111827]">
                Simple pricing
              </h3>
              <p>Investors pay a simple subscription; agents stay free but vetted.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}