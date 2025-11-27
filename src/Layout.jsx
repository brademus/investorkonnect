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
    <div className="ik-body-shell">
      {showNav && !isNoNavPage && (
        <nav className="ik-navbar">
          <div className="ik-container flex items-center justify-between h-16">
            <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'hsl(43 59% 52%)' }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold tracking-tight" style={{ color: 'hsl(0 0% 10%)' }}>
                  INVESTOR KONNECT
                </span>
                <span className="text-[11px] ik-text-muted -mt-1">
                  Verified agents. Protected deals.
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {currentNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`ik-btn-pill flex items-center gap-2 h-9 ${
                    location.pathname === item.href
                      ? "border-amber-300"
                      : ""
                  }`}
                  style={location.pathname === item.href ? { background: 'hsl(48 100% 95%)', color: 'hsl(43 71% 33%)', borderColor: 'hsl(44 68% 75%)' } : {}}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">{item.name}</span>
                </Link>
              ))}

              {isAdmin && (
                <Link
                  to={createPageUrl("Admin")}
                  className="ik-btn-pill flex items-center gap-2 h-9"
                  style={{ borderColor: 'hsl(43 67% 64%)', color: 'hsl(43 71% 33%)' }}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Admin</span>
                </Link>
              )}

              <Link to={createPageUrl("Profile")}>
                <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors" style={{ background: 'hsl(0 0% 92%)' }}>
                  <User className="w-4 h-4" style={{ color: 'hsl(0 0% 13%)' }} />
                </button>
              </Link>
            </div>
          </div>
        </nav>
      )}

      <main className={showNav && !isNoNavPage ? "ik-container py-6 sm:py-8" : ""}>
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