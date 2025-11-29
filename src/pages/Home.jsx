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
        <div className="mx-auto max-w-6xl px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: '#D3A029' }}>
              <HomeIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-[#111827]">
              INVESTOR KONNECT
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("HowItWorks")} className="hidden sm:block">
              <button className="ik-pill">How it works</button>
            </Link>
            <button onClick={handleLogin} className="ik-pill">
              Log in
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 lg:px-8 py-12 lg:py-20">
        <div className="grid gap-10 lg:gap-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center">
          {/* Left: copy */}
          <section>
            <p className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-full bg-white/80 px-3 text-xs font-medium text-[#6B7280] shadow-sm border border-[#E5E7EB]">
                <Shield className="w-3.5 h-3.5 mr-1.5 text-[#D3A029]" />
                Verified investor-friendly agents
              </span>
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-[#111827] mb-5">
              Stop training retail agents.
              <br />
              <span className="text-[#D3A029]">Start closing investor deals.</span>
            </h1>

            <p className="ik-section-subtitle max-w-xl mb-7 text-base sm:text-lg leading-relaxed">
              Investor Konnect matches your strategy and market with agents who already know how to work with real estate investors — then keeps everything in one shared deal room.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-8">
              <button
                type="button"
                onClick={handleContinue}
                disabled={!localState}
                className="ik-btn-gold text-base px-5 py-2.5 disabled:opacity-50"
              >
                Submit your first deal
              </button>
              <Link to={createPageUrl("Investors")}>
                <button className="ik-pill text-sm">For investors</button>
              </Link>
              <Link to={createPageUrl("Agents")}>
                <button className="ik-pill text-sm">For agents</button>
              </Link>
            </div>

            <ul className="space-y-2.5 text-sm text-[#4B5563]">
              <li className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#D3A029]" />
                Vetted agents with investor track records
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#D3A029]" />
                Shared deal rooms with chat & milestones
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-[#D3A029]" />
                Contracts pre-filled from your conversation
              </li>
            </ul>
          </section>

          {/* Right: state selector card */}
          <div className="lg:justify-self-end w-full max-w-md">
            <div className="ik-card p-5 sm:p-6">
              <header className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF3C7]">
                  <MapPin className="w-5 h-5 text-[#D3A029]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Where are you looking to invest?
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Select your target state to see investor-friendly agents.
                  </p>
                </div>
              </header>

              {/* Search input */}
              <div className="mb-4 flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
                <Search className="w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for a state..."
                  className="flex-1 bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
                />
              </div>

              {/* State grid */}
              <div className="max-h-64 overflow-y-auto pb-1">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {filteredStates.map((state) => (
                    <button
                      key={state.code}
                      type="button"
                      onClick={() => setLocalState(state)}
                      className={
                        "rounded-xl border text-xs sm:text-sm px-3 py-2 text-left transition " +
                        (localState?.code === state.code
                          ? "border-[#D3A029] bg-[#FFFBEB] text-[#111827]"
                          : "border-[#E5E7EB] bg-white hover:border-[#D3A029]/70")
                      }
                    >
                      <div className="font-medium">{state.code}</div>
                      <div className="text-[0.7rem] text-[#6B7280]">{state.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!localState}
                  className="ik-btn-gold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}