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
    <div className="ik-body-shell ik-hero">
      {/* Public navbar */}
      <nav className="ik-navbar">
        <div className="ik-container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'hsl(43 59% 52%)' }}>
              <HomeIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight" style={{ color: 'hsl(0 0% 10%)' }}>
              INVESTOR KONNECT
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("HowItWorks")} className="hidden sm:block">
              <button className="ik-btn-pill">How it works</button>
            </Link>
            <button onClick={handleLogin} className="ik-btn-pill">
              Log in
            </button>
          </div>
        </div>
      </nav>

      <main className="ik-container ik-section">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
          {/* Left: copy */}
          <section>
            <div className="ik-badge-gold mb-4 inline-flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Verified investor-friendly agents</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4" style={{ color: 'hsl(0 0% 0%)' }}>
              Stop training retail agents.
              <br />
              <span style={{ color: 'hsl(43 71% 42%)' }}>Start closing investor deals.</span>
            </h1>
            <p className="ik-text-subtle text-base sm:text-lg mb-6 max-w-xl">
              Investor Konnect matches your strategy and market with agents who already know how to work with real estate investors — then keeps everything in one shared deal room.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <button
                type="button"
                onClick={handleContinue}
                disabled={!localState}
                className="ik-btn-gold flex items-center gap-2 disabled:opacity-50"
              >
                <MapPin className="w-4 h-4" />
                Submit your first deal
              </button>
              <Link to={createPageUrl("Investors")}>
                <button className="ik-btn-pill">For investors</button>
              </Link>
              <Link to={createPageUrl("Agents")}>
                <button className="ik-btn-pill">For agents</button>
              </Link>
            </div>

            <ul className="space-y-2 text-sm ik-text-subtle">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" style={{ color: 'hsl(43 71% 42%)' }} />
                Vetted agents with investor track records
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" style={{ color: 'hsl(43 71% 42%)' }} />
                Shared deal rooms with chat & milestones
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" style={{ color: 'hsl(43 71% 42%)' }} />
                Contracts pre-filled from your conversation
              </li>
            </ul>
          </section>

          {/* Right: state selector card */}
          <section className="ik-card p-5 sm:p-6">
            <header className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(48 100% 95%)' }}>
                <MapPin className="w-5 h-5" style={{ color: 'hsl(43 71% 42%)' }} />
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'hsl(0 0% 0%)' }}>
                  Where are you looking to invest?
                </h2>
                <p className="text-xs ik-text-muted">
                  Select your target state to see investor-friendly agents.
                </p>
              </div>
            </header>

            <div className="ik-search-bar mb-4">
              <Search className="w-4 h-4 ik-text-muted" />
              <input
                type="text"
                placeholder="Search for a state…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm placeholder:ik-text-muted"
                style={{ color: 'hsl(0 0% 10%)' }}
              />
            </div>

            <div className="max-h-80 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredStates.map((state) => (
                  <button
                    key={state.code}
                    type="button"
                    onClick={() => setLocalState(state)}
                    className={`ik-card p-3 text-left rounded-xl border-2 transition-all ${
                      localState?.code === state.code
                        ? ""
                        : "hover:border-amber-300"
                    }`}
                    style={localState?.code === state.code ? { borderColor: 'hsl(43 59% 52%)', background: 'hsl(51 100% 98%)' } : { borderColor: 'hsl(0 0% 92%)' }}
                  >
                    <div className="text-sm font-semibold" style={{ color: 'hsl(0 0% 0%)' }}>
                      {state.code}
                    </div>
                    <div className="text-xs ik-text-muted mt-1">{state.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={!localState}
                onClick={handleContinue}
                className="ik-btn-gold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}