
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  Menu, X, ChevronDown, Shield, LogOut, User, 
  LayoutDashboard, Settings, DollarSign,
  Users, Star, BookOpen, Lock, Mail, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PUBLIC_APP_URL = "https://agent-vault-da3d088b.base44.app";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setupMeta();
    checkAuth();
  }, [location.pathname]);

  const setupMeta = () => {
    const metaRobots = document.querySelector('meta[name="robots"]') || document.createElement('meta');
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";
    if (!document.querySelector('meta[name="robots"]')) {
      document.head.appendChild(metaRobots);
    }

    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link');
    canonical.rel = "canonical";
    canonical.href = `${PUBLIC_APP_URL}${location.pathname}`;
    if (!document.querySelector('link[rel="canonical"]')) {
      document.head.appendChild(canonical);
    }
  };

  const checkAuth = async () => {
    try {
      const authenticated = await base44.auth.isAuthenticated();
      if (authenticated) {
        const currentUser = await base44.auth.me();
        if (currentUser) {
          // Fetch profile for additional info
          const response = await fetch('/functions/me', {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store'
          });
          
          if (response.ok) {
            const state = await response.json();
            
            console.log('[Layout] User state loaded:', {
              email: currentUser.email,
              profileRole: state.profile?.role,
              userRole: currentUser.role
            });
            
            setUser({
              email: currentUser.email,
              full_name: state.profile?.full_name || currentUser.full_name,
              role: state.profile?.role || currentUser.role, // Check both profile and user role
              plan: state.subscription?.tier
            });
          } else {
            setUser({
              email: currentUser.email,
              full_name: currentUser.full_name,
              role: currentUser.role // Fallback to user role
            });
          }
        }
      }
    } catch (error) {
      console.error('[Layout] Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    console.log('[Layout] Redirecting to login');
    base44.auth.redirectToLogin(window.location.pathname);
  };

  const handleGetStarted = () => {
    if (user) {
      window.location.href = createPageUrl("Pricing");
    } else {
      handleSignIn();
    }
  };

  const handleLogout = () => {
    if (loggingOut) return;
    
    setLoggingOut(true);
    console.log('[Layout] Signing out...');
    
    // Use Base44's built-in logout with redirect
    // This will clear the session and redirect to home page
    base44.auth.logout("/");
  };

  const publicNav = [
    { name: "How It Works", href: createPageUrl("HowItWorks"), icon: Info },
    { name: "Investors", href: createPageUrl("Investors"), icon: DollarSign },
    { name: "Agents", href: createPageUrl("Agents"), icon: Users },
    { name: "Pricing", href: createPageUrl("Pricing"), icon: DollarSign },
    { name: "Reviews", href: createPageUrl("Reviews"), icon: Star },
    { name: "Resources", href: createPageUrl("Resources"), icon: BookOpen },
    { name: "About", href: createPageUrl("About"), icon: Info },
    { name: "Contact", href: createPageUrl("Contact"), icon: Mail },
  ];

  const isActive = (href) => location.pathname === href;
  
  // Check if user is admin (for showing admin panel)
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="bg-slate-900 text-white py-2 px-4 text-center text-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Verified licenses • NDA-gated rooms • Transparent reviews</span>
        </div>
      </div>

      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-xl text-slate-900">AgentVault</div>
                <div className="text-xs text-slate-500 -mt-1">Verified agents. Protected deals.</div>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {publicNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3">
              {!loading && !user && (
                <>
                  <Button variant="ghost" onClick={handleSignIn}>
                    Sign In
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleGetStarted}
                  >
                    Get Started
                  </Button>
                </>
              )}
              
              {user && (
                <>
                  <Link to={createPageUrl("Dashboard")}>
                    <Button variant="ghost" className="gap-2">
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Button>
                  </Link>
                  
                  {/* ADMIN PANEL - Direct Link (always visible for testing) */}
                  <Link to={createPageUrl("Admin")}>
                    <Button variant="ghost" className="gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                      <Shield className="w-4 h-4" />
                      Admin
                    </Button>
                  </Link>
                  
                  {!user.plan && (
                    <Link to={createPageUrl("Pricing")}>
                      <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                        <Shield className="w-4 h-4" />
                        Upgrade
                      </Button>
                    </Link>
                  )}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="gap-2">
                        <User className="w-4 h-4" />
                        {user.full_name || user.email?.split('@')[0] || 'Account'}
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="px-2 py-1.5 text-sm">
                        <p className="font-medium">{user.full_name || "User"}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                        {user.role && (
                          <p className="text-xs text-blue-600 mt-1 capitalize">
                            {user.role} {isAdmin && '👑'}
                          </p>
                        )}
                        {user.plan && (
                          <p className="text-xs text-emerald-600 capitalize">
                            {user.plan} Plan
                          </p>
                        )}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => window.location.href = createPageUrl("Dashboard")}>
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.location.href = createPageUrl("AccountProfile")}>
                        <User className="w-4 h-4 mr-2" />
                        Profile & Preferences
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.location.href = createPageUrl("AccountBilling")}>
                        <Settings className="w-4 h-4 mr-2" />
                        Billing & Subscription
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => window.location.href = createPageUrl("Admin")}>
                            <Shield className="w-4 h-4 mr-2" />
                            Admin Panel 👑
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}>
                        <LogOut className="w-4 h-4 mr-2" />
                        {loggingOut ? "Signing out..." : "Sign Out"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-4 space-y-2">
              {publicNav.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              <div className="border-t border-slate-200 pt-2 mt-2">
                {!user ? (
                  <>
                    <Button variant="ghost" className="w-full justify-start" onClick={() => { setMobileMenuOpen(false); handleSignIn(); }}>
                      Sign In
                    </Button>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleGetStarted();
                      }}
                    >
                      Get Started
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to={createPageUrl("Dashboard")} onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                      </Button>
                    </Link>
                    <Link to={createPageUrl("Admin")} onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2 text-orange-600">
                        <Shield className="w-4 h-4" />
                        Admin Panel
                      </Button>
                    </Link>
                    <Link to={createPageUrl("AccountProfile")} onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2">
                        <User className="w-4 h-4" />
                        Profile
                      </Button>
                    </Link>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-2 mt-2"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      disabled={loggingOut}
                    >
                      <LogOut className="w-4 h-4" />
                      {loggingOut ? "Signing out..." : "Sign Out"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      <main>{children}</main>

      <footer className="bg-slate-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">AgentVault</span>
              </div>
              <p className="text-slate-400 text-sm">
                Connecting investors with verified, investor-friendly real estate agents through secure, protected deal flow.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to={createPageUrl("HowItWorks")} className="hover:text-white">How It Works</Link></li>
                <li><Link to={createPageUrl("Investors")} className="hover:text-white">For Investors</Link></li>
                <li><Link to={createPageUrl("Agents")} className="hover:text-white">For Agents</Link></li>
                <li><Link to={createPageUrl("Pricing")} className="hover:text-white">Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to={createPageUrl("Reviews")} className="hover:text-white">Reviews</Link></li>
                <li><Link to={createPageUrl("Resources")} className="hover:text-white">Blog</Link></li>
                <li><Link to={createPageUrl("Security")} className="hover:text-white">Security</Link></li>
                <li><Link to={createPageUrl("FAQ")} className="hover:text-white">FAQ</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to={createPageUrl("About")} className="hover:text-white">About</Link></li>
                <li><Link to={createPageUrl("Contact")} className="hover:text-white">Contact</Link></li>
                <li><Link to={createPageUrl("PrivacyPolicy")} className="hover:text-white">Privacy Policy</Link></li>
                <li><Link to={createPageUrl("Terms")} className="hover:text-white">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-8 pt-8 text-sm text-slate-400">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p>© 2025 AgentVault. All rights reserved.</p>
              <div className="flex gap-6">
                <Link to={createPageUrl("ReviewPolicy")} className="hover:text-white">Review Policy</Link>
                <Link to={createPageUrl("Cookies")} className="hover:text-white">Cookies</Link>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4 text-center md:text-left">
              Not investment advice. AgentVault is not a broker-dealer and does not provide financial, legal, or investment advice. All investments carry risk.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
