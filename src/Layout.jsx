import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { WizardProvider } from "@/components/WizardContext";
import { AIChatbot } from "@/components/AIChatbot";
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
    <div className="min-h-screen bg-[#FAF7F2] text-[#111827]">
      {showNav && !isNoNavPage && (
        <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 lg:px-8 h-16 flex items-center justify-between">
            <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: '#D3A029' }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold tracking-tight text-[#111827]">
                  INVESTOR KONNECT
                </span>
                <span className="text-[11px] text-[#6B7280] -mt-0.5">
                  Verified agents. Protected deals.
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {currentNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`ik-pill flex items-center gap-2 h-9 transition-colors ${
                    location.pathname === item.href
                      ? "bg-[#FFFBEB] border-[#D3A029] text-[#92400E]"
                      : "hover:border-[#D3A029]/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">{item.name}</span>
                </Link>
              ))}

              {isAdmin && (
                <Link
                  to={createPageUrl("Admin")}
                  className="ik-pill flex items-center gap-2 h-9 border-[#D3A029]/50 text-[#92400E]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Admin</span>
                </Link>
              )}

              <Link to={createPageUrl("Profile")}>
                <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-[#F3F4F6] hover:bg-[#E5E7EB]">
                  <User className="w-4 h-4 text-[#374151]" />
                </button>
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className={showNav && !isNoNavPage ? "mx-auto max-w-6xl px-4 lg:px-8 py-8 lg:py-12" : ""}>
        {children}
      </main>

      {user && <AIChatbot />}
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