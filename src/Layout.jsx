import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { WizardProvider } from "@/components/WizardContext";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Shield, FileText, User, Settings, ShieldCheck, MessageSquare } from "lucide-react";

// Create a QueryClient for the entire app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
    '/matches',
    '/PostAuth',
    '/DashboardInvestor'
  ];

  // Full-bleed pages that handle their own layout completely
  const fullBleedPages = ['/Room', '/AgentHome', '/Dashboard', '/AgentDirectory'];
  const isFullBleedPage = fullBleedPages.some(path => location.pathname.toLowerCase().includes(path.toLowerCase()));

  const isNoNavPage = noNavPages.some(path => location.pathname === path || location.pathname.startsWith(path));
  const showNav = !loading && user && onboarded && (hasRoom || location.pathname.startsWith('/room/'));
  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  const investorNav = [
    { name: "Account", href: createPageUrl("AccountProfile"), icon: Settings },
  ];

  const agentNav = [
    { name: "Account", href: createPageUrl("AccountProfile"), icon: Settings },
  ];

  const currentNav = role === 'investor' ? investorNav : role === 'agent' ? agentNav : [];

  return (
    <div className="ik-shell">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --font-serif: 'Cinzel', serif;
          --font-sans: 'Inter', sans-serif;
        }
        body {
          font-family: var(--font-sans);
          background-color: #050505 !important;
          background-image: linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/158666991_Gemini_Generated_Image_1u4rzq1u4rzq1u4r.png') !important;
          background-size: cover !important;
          background-position: center center !important;
          background-attachment: fixed !important;
          background-repeat: no-repeat !important;
        }
        h1, h2, h3, h4, h5, h6, .font-serif {
          font-family: var(--font-serif) !important;
          letter-spacing: -0.02em;
        }
      `}</style>
      {/* Top nav - fixed, minimal, Airbnb-like */}
      {showNav && !isNoNavPage && (
        <header className="fixed inset-x-0 top-0 z-30 border-b border-[#1F1F1F] bg-[#0D0D0D]/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:max-w-7xl lg:px-8">
            {/* Left: logo + brand */}
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
              alt="Investor Konnect"
              className="h-8 w-8 object-contain cursor-pointer"
              onClick={() => window.location.href = createPageUrl("Dashboard")}
            />
            <span className="text-base font-light tracking-wide text-[#E3C567]">
              Investor Konnect
            </span>

            {/* Center nav – simple, small text links */}
            <nav className="hidden items-center gap-6 text-xs font-medium text-[#808080] md:flex">
              <Link to={createPageUrl("Home")} className="hover:text-[#E3C567]">Home</Link>
              <Link to={createPageUrl("HowItWorks")} className="hover:text-[#E3C567]">How it works</Link>
              <Link to={createPageUrl("Pricing")} className="hover:text-[#E3C567]">Pricing</Link>
              <Link to={createPageUrl("Investors")} className="hover:text-[#E3C567]">For investors</Link>
              <Link to={createPageUrl("Agents")} className="hover:text-[#E3C567]">For agents</Link>
            </nav>

            {/* Right: Auth / profile */}
            <div className="flex items-center gap-2">
              {currentNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`ik-chip flex items-center gap-2 h-9 transition-colors ${
                    location.pathname === item.href
                      ? "bg-[#E3C567]/20 border-[#E3C567] text-[#E3C567]"
                      : "hover:border-[#E3C567]/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">{item.name}</span>
                </Link>
              ))}

              {isAdmin && (
                <Link
                  to={createPageUrl("Admin")}
                  className="ik-chip flex items-center gap-2 h-9 border-[#E3C567]/50 text-[#E3C567]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Admin</span>
                </Link>
                )}

                <Link to={createPageUrl("AccountProfile")}>
                <button className="w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-[#0D0D0D] hover:bg-[#1F1F1F]">
                  <User className="w-4 h-4 text-[#E3C567]" />
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

      {/* Sonner toast notifications */}
      <Toaster />

      {/* Floating Messages Button */}
      {user && onboarded && !isNoNavPage && (
        <Link 
          to={createPageUrl("Room")}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#E3C567] hover:bg-[#EDD89F] rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110"
        >
          <MessageSquare className="w-6 h-6 text-black" />
        </Link>
      )}

      </div>
      );
      }

export default function Layout({ children, currentPageName }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WizardProvider>
        <LayoutContent>{children}</LayoutContent>
      </WizardProvider>
    </QueryClientProvider>
  );
}