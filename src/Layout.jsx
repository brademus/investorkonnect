import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { WizardProvider } from "@/components/WizardContext";
import { Shield, FileText, User, Settings, ShieldCheck } from "lucide-react";

/**
 * LAYOUT - Conditional Navigation + Wizard Provider
 * 
 * Wraps entire app with WizardProvider.
 * NO navigation shown during wizard flow (pre-room) OR if not onboarded.
 * Navigation appears ONLY after user is fully onboarded and has completed setup.
 */
function LayoutContent({ children }) {
  const location = useLocation();
  const { loading, user, role, hasRoom, onboarded, profile } = useCurrentProfile();

  // Wizard pages (no nav) + onboarding pages
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

  // Show nav ONLY if:
  // 1. User is logged in AND onboarded, AND
  // 2. User has at least one room, OR is on a room page
  const showNav = !loading && user && onboarded && (hasRoom || location.pathname.startsWith('/room/'));

  // Check if current user is admin
  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  // Investor nav
  const investorNav = [
    { name: "Deal Rooms", href: createPageUrl("DealRooms"), icon: FileText },
    { name: "Account", href: createPageUrl("AccountProfile"), icon: Settings },
  ];

  // Agent nav
  const agentNav = [
    { name: "Deal Rooms", href: createPageUrl("DealRooms"), icon: FileText },
    { name: "Account", href: createPageUrl("AccountProfile"), icon: Settings },
  ];

  const currentNav = role === 'investor' ? investorNav : role === 'agent' ? agentNav : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Conditional Top Navigation */}
      {showNav && !isNoNavPage && (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-xl text-slate-900">AgentVault</div>
                  <div className="text-xs text-slate-500 -mt-1">Verified agents. Protected deals.</div>
                </div>
              </Link>

              <div className="flex items-center gap-1">
                {currentNav.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      location.pathname === item.href
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                ))}
                
                {/* Admin Button - Only visible to admins */}
                {isAdmin && (
                  <Link
                    to={createPageUrl("Admin")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      location.pathname === createPageUrl("Admin")
                        ? "bg-orange-50 text-orange-700 border border-orange-300"
                        : "text-orange-700 hover:bg-orange-50 border border-orange-200"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link to={createPageUrl("Profile")}>
                  <button className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors">
                    <User className="w-4 h-4 text-slate-700" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main>{children}</main>
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