import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { WizardProvider } from "@/components/WizardContext";

import { Shield, FileText, User, Settings, ShieldCheck } from "lucide-react";

/**
 * LAYOUT - Airbnb-style shell with conditional navigation
 */
function LayoutContent({ children }) {
  const location = useLocation();
  const { loading, user, role, hasRoom, onboarded, profile } = useCurrentProfile();

  const noNavPages = [
    '/',
    '/role',
    '/onboarding/investor',
    '/onboarding/agent',
    '/onboarding',
    '/verify',
    '/nda',
    '/matches'
  ];

  // Full-bleed pages that handle their own layout completely
  const fullBleedPages = ['/Room', '/InvestorHome', '/AgentHome', '/Dashboard', '/DealRooms', '/AgentDirectory'];
  const isFullBleedPage = fullBleedPages.some(path => location.pathname.toLowerCase().includes(path.toLowerCase()));

  const isNoNavPage = noNavPages.some(path => location.pathname === path || location.pathname.startsWith(path));
  const showNav = !loading && user && onboarded && (hasRoom || location.pathname.startsWith('/room/'));
  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  const investorNav = [
    { name: "Deal Rooms", href: createPageUrl("DealRooms"), icon: FileText },
    { name: "Account", href: createPageUrl("AccountProfile"), icon: Settings },
  ];

  const agentNav = [
    { name: "Deal Rooms", href: createPageUrl("DealRooms"), icon: FileText },
    { name: "Account", href: createPageUrl("AccountProfile"), icon: Settings },
  ];

  const currentNav = role === 'investor' ? investorNav : role === 'agent' ? agentNav : [];

  return (
    <div className="ik-shell">
      {/* Top nav - fixed, minimal, Airbnb-like */}
      {showNav && !isNoNavPage && (
        <header className="fixed inset-x-0 top-0 z-30 border-b border-[#38342F] bg-[#151311]/95 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:max-w-7xl lg:px-8">
            {/* Left: logo + brand */}
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
              alt="Investor Konnect"
              className="h-8 w-8 object-contain cursor-pointer"
              onClick={() => window.location.href = createPageUrl("Dashboard")}
            />
            <span className="text-sm font-semibold tracking-tight text-[#C9A961]">
              Investor Konnect
            </span>

            {/* Center nav – simple, small text links */}
            <nav className="hidden items-center gap-6 text-xs font-medium text-[#9E9E9E] md:flex">
              <Link to={createPageUrl("Home")} className="hover:text-[#C9A961]">Home</Link>
              <Link to={createPageUrl("HowItWorks")} className="hover:text-[#C9A961]">How it works</Link>
              <Link to={createPageUrl("Pricing")} className="hover:text-[#C9A961]">Pricing</Link>
              <Link to={createPageUrl("Investors")} className="hover:text-[#C9A961]">For investors</Link>
              <Link to={createPageUrl("Agents")} className="hover:text-[#C9A961]">For agents</Link>
            </nav>

            {/* Right: Auth / profile */}
            <div className="flex items-center gap-2">
              {currentNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`ik-chip flex items-center gap-2 h-9 transition-colors ${
                    location.pathname === item.href
                      ? "bg-[#C9A961]/20 border-[#C9A961] text-[#C9A961]"
                      : "hover:border-[#C9A961]/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">{item.name}</span>
                </Link>
              ))}

              {isAdmin && (
                <Link
                  to={createPageUrl("Admin")}
                  className="ik-chip flex items-center gap-2 h-9 border-[#C9A961]/50 text-[#C9A961]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Admin</span>
                </Link>
              )}

              <Link to={createPageUrl("AccountProfile")}>
                <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-[#292521] hover:bg-[#38342F]">
                  <User className="w-4 h-4 text-[#C9A961]" />
                </button>
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Page content – centered, offset for fixed header */}
      <main className={showNav && !isNoNavPage && !isFullBleedPage ? "mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 lg:max-w-7xl lg:px-8 lg:pt-24" : ""}>
        {children}
      </main>


    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <WizardProvider>
      <LayoutContent>{children}</LayoutContent>
    </WizardProvider>
  );
}