import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { WizardProvider } from "@/components/WizardContext";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Shield, FileText, User, Settings, ShieldCheck, MessageSquare, LogOut, Eye } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

if (!window.__SENTRY_INITIALIZED__) {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  Sentry.init({
    dsn: "https://6e2d7e141ce3106aa061a12a7a7ef3d3@o4510907728986112.ingest.us.sentry.io/4510908064006144",
    release: "investor-konnect@2.0.0",
    environment: isLocalhost ? "development" : "production",
    sendDefaultPii: true,
    enableLogs: true,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // #5 — Production-appropriate sampling rates
    tracesSampleRate: isLocalhost ? 1.0 : 0.15,
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.base44\.app/],
    replaysSessionSampleRate: isLocalhost ? 0.5 : 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
  window.__SENTRY_INITIALIZED__ = true;
}

// Singleton QueryClient — survives HMR re-evaluation of this module
if (!window.__QUERY_CLIENT__) {
  window.__QUERY_CLIENT__ = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
        gcTime: 300_000,
      },
    },
  });
}
const queryClient = window.__QUERY_CLIENT__;

/**
 * LAYOUT - Airbnb-style shell with conditional navigation
 */
function LayoutContent({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, user, role, hasRoom, onboarded, profile, error } = useCurrentProfile();
  
  // #3 — Identify user in Sentry for better debugging
  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: profile?.full_name || user.full_name || undefined,
      });
      Sentry.setTag("user_role", role || "unknown");
      Sentry.setTag("subscription_status", profile?.subscription_status || "none");
    } else if (!loading) {
      Sentry.setUser(null);
    }
  }, [user, profile, role, loading]);

  useEffect(() => {
    if (error) {
      console.error('[Layout] Profile error:', error);
      const isAuthError = typeof error === 'string' && (error.includes('Authentication required') || error.includes('401') || error.includes('Unauthorized'));
      if (!isAuthError) {
        Sentry.captureException(new Error(`Profile load error: ${error}`), { tags: { source: "useCurrentProfile" } });
      }
    }
  }, [error]);

  const [showAppLoader, setShowAppLoader] = React.useState(true);
  React.useEffect(() => {
    if (loading) {
      setShowAppLoader(true);
    } else {
      const t = setTimeout(() => setShowAppLoader(false), 150);
      return () => clearTimeout(t);
    }
  }, [loading]);

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
    '/RoleLanding'
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

  const marketingPages = [
    createPageUrl("RoleLanding"),
    createPageUrl("InvestorLanding"),
    createPageUrl("AgentLanding"),
    createPageUrl("Investors"),
    createPageUrl("Agents"),
    createPageUrl("Home"),
    createPageUrl("About"),
    createPageUrl("HowItWorks"),
    createPageUrl("Pricing"),
  ];
  const useHeavyBg = !marketingPages.some(p => location.pathname === p);

  const currentNav = role === 'investor' ? investorNav : role === 'agent' ? agentNav : [];

  return (
    <div className="ik-shell" style={useHeavyBg ? { backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/158666991_Gemini_Generated_Image_1u4rzq1u4rzq1u4r.png')", backgroundSize: 'cover', backgroundPosition: 'center center', backgroundAttachment: 'fixed', backgroundRepeat: 'no-repeat', backgroundColor: '#0D0D0D' } : { backgroundColor: '#0D0D0D' }}>
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
        }
        h1, h2, h3, h4, h5, h6, .font-serif {
          font-family: var(--font-serif) !important;
          letter-spacing: -0.02em;
        }
      `}</style>
      {/* Top nav - fixed, minimal, Airbnb-like */}
      {showNav && !isNoNavPage && (
        <header className="hidden md:block fixed inset-x-0 top-0 z-30 border-b border-[#1F1F1F] bg-[#0D0D0D]/80 backdrop-blur-sm">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:max-w-7xl lg:px-8">
              {/* Left: Empty spacer for balance */}
              <div className="flex-1"></div>

              {/* Center: logo + brand */}
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(createPageUrl("Pipeline"))}>
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
                  alt="Investor Konnect"
                  className="h-8 w-8 object-contain"
                />
                <span className="text-base font-light tracking-wide text-[#E3C567] hover:text-[#EDD89F] transition-colors">
                  Investor Konnect
                </span>
              </div>

              {/* Right: Auth / profile */}
              <div className="flex items-center gap-2 flex-1 justify-end">
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

                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 h-9 rounded-full transition-colors bg-[#0D0D0D] hover:bg-[#1F1F1F] border border-[#1F1F1F]">
                      <User className="w-4 h-4 text-[#E3C567]" />
                      <span className="text-sm text-[#FAFAFA]">{profile?.full_name || user?.email?.split('@')[0] || 'Account'}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#0D0D0D] border-[#1F1F1F]">
                    {isAdmin && (
                      <DropdownMenuItem onClick={() => navigate(createPageUrl("Admin"))} className="text-[#E3C567] cursor-pointer">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate(createPageUrl("AccountProfile"))} className="text-[#FAFAFA] cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      Edit Profile
                    </DropdownMenuItem>
                    {profile?.id && (
                      <DropdownMenuItem 
                        onClick={() => navigate(
                          role === 'agent' 
                            ? `${createPageUrl("AgentProfile")}?profileId=${profile.id}` 
                            : `${createPageUrl("InvestorProfile")}?profileId=${profile.id}`
                        )} 
                        className="text-[#FAFAFA] cursor-pointer"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View My Public Profile
                      </DropdownMenuItem>
                    )}
                    {role === 'investor' && (
                      <DropdownMenuItem onClick={() => navigate(createPageUrl("Pricing"))} className="text-[#FAFAFA] cursor-pointer">
                        <FileText className="w-4 h-4 mr-2" />
                        Subscription
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate(createPageUrl("Logout"))} className="text-[#FAFAFA] cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
            </div>
          </div>
        </header>
      )}

      {/* Global loading overlay to prevent flicker until data is ready */}
      {showAppLoader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D0D]">
          <LoadingAnimation className="w-48 h-48" />
        </div>
      )}

      {/* Page content – centered, offset for fixed header */}
      <main
        className={showNav && !isNoNavPage && !isFullBleedPage ? "mx-auto max-w-6xl px-4 pb-28 md:pb-12 pt-4 md:pt-20 sm:px-6 lg:max-w-7xl lg:px-8 lg:pt-24" : ""}
        style={{ opacity: showAppLoader ? 0 : 1, pointerEvents: showAppLoader ? 'none' : 'auto', transition: 'opacity 150ms ease' }}
      >
        {children}
      </main>

      {/* Sonner toast notifications */}
      <Toaster />

      {/* Mobile bottom nav */}
      {showNav && !isNoNavPage && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[#1F1F1F] bg-[#0D0D0D]/90 backdrop-blur md:hidden">
          <div className="mx-auto max-w-3xl px-6 py-2 grid grid-cols-3 gap-2 text-xs">
            <button onClick={() => navigate(createPageUrl("Pipeline"))} className="flex flex-col items-center gap-1 text-[#FAFAFA]/80">
              <FileText className="w-5 h-5 text-[#E3C567]" />
              <span>Pipeline</span>
            </button>
            <button onClick={() => navigate(createPageUrl("HowItWorks"))} className="flex flex-col items-center gap-1 text-[#FAFAFA]/80">
              <FileText className="w-5 h-5 text-[#E3C567]" />
              <span>Learn</span>
            </button>
            <button onClick={() => navigate(createPageUrl("AccountProfile"))} className="flex flex-col items-center gap-1 text-[#FAFAFA]/80">
              <Settings className="w-5 h-5 text-[#E3C567]" />
              <span>Account</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Messages Button */}
      {user && onboarded && !isNoNavPage && (
        <Link 
          to={createPageUrl("Room")}
          className="hidden md:flex fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#E3C567] hover:bg-[#EDD89F] rounded-full items-center justify-center shadow-2xl transition-all hover:scale-110"
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
        <ErrorBoundary>
          <LayoutContent>{children}</LayoutContent>
        </ErrorBoundary>
      </WizardProvider>
    </QueryClientProvider>
  );
}