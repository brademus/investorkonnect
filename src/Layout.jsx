import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Shield, FileText, User, Settings } from "lucide-react";

/**
 * LAYOUT - Conditional Navigation
 * 
 * NO navigation shown during wizard flow (pre-room).
 * Navigation appears ONLY after user has at least one room.
 */
export default function Layout({ children }) {
  const location = useLocation();
  const { loading, user, role, hasRoom } = useCurrentProfile();

  // Wizard pages (no nav)
  const wizardPages = [
    '/',
    '/role',
    '/onboarding/investor',
    '/onboarding/agent',
    '/verify',
    '/nda',
    '/matches'
  ];

  const isWizardPage = wizardPages.some(path => location.pathname === path || location.pathname.startsWith(path));

  // Show nav ONLY if:
  // 1. User has at least one room, OR
  // 2. User is on a room page
  const showNav = !loading && user && (hasRoom || location.pathname.startsWith('/room/'));

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
      {showNav && (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to={createPageUrl("DealRooms")} className="flex items-center gap-2">
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