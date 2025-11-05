
import React, { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Shield, CheckCircle, Star, Lock, Users,
  TrendingUp, FileText, ArrowRight, Zap, AlertCircle
} from "lucide-react";
import InvestorHome from "./InvestorHome";
import AgentHome from "./AgentHome";

const PUBLIC_APP_URL = "https://agent-vault-da3d088b.base44.app";

export default function Home() {
  const navigate = useNavigate();
  const { loading, user, role, onboarded, kycStatus } = useCurrentProfile();
  const hasChecked = useRef(false);
  const autoRouted = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    
    setupPageMeta();
    
    // Check for successful payment
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      toast.success("🎉 Payment successful! Your subscription is now active.", {
        duration: 5000,
      });
      
      // Clean up URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // CRITICAL FIX: Auto-route to onboarding ONLY after loading is complete and session verified
  // Wait 800ms to show public home first (no hard redirects)
  useEffect(() => {
    if (!loading && user && !onboarded && !autoRouted.current) {
      console.log('[Home] User signed in but not onboarded, auto-routing to /onboarding in 800ms...');
      autoRouted.current = true;
      
      const timer = setTimeout(() => {
        navigate(createPageUrl("Onboarding"));
      }, 800);
      
      return () => clearTimeout(timer);
    }
  }, [loading, user, onboarded, navigate]);

  const setupPageMeta = () => {
    document.title = "AgentVault - Verified Agents. Protected Deal Flow.";

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = "AgentVault connects investors with vetted, investor-friendly agents—backed by verified reviews, NDAs, and an auditable activity log.";

    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: 'Home',
        page_location: window.location.href
      });
    }
  };

  const handleGetStarted = () => {
    if (user) {
      if (!onboarded) {
        navigate(createPageUrl("Onboarding"));
      } else {
        navigate(createPageUrl("Pricing"));
      }
    } else {
      // SIMPLE LOGIN - Let Base44 handle auth flow
      base44.auth.redirectToLogin();
    }
  };

  const handleGetMatched = () => {
    if (user) {
      navigate(createPageUrl("Dashboard"));
    } else {
      // SIMPLE LOGIN - Let Base44 handle auth flow
      base44.auth.redirectToLogin();
    }
  };

  // CONDITIONAL RENDERING BASED ON AUTH + ROLE
  // CRITICAL: Show loading spinner during initial check - prevents flash
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading...</div>
      </div>
    );
  }

  // If signed in AND onboarded, show role-specific home (NO REDIRECT, conditional render)
  if (user && onboarded) {
    if (role === 'investor') {
      return <InvestorHome />;
    }
    if (role === 'agent') {
      return <AgentHome />;
    }
  }

  // Otherwise (not signed in OR not onboarded), show public home
  const features = [
    {
      icon: Shield,
      title: "Verified Agents Only",
      description: "Every agent undergoes license verification, background checks, and reference validation before approval."
    },
    {
      icon: Lock,
      title: "NDA-Protected Deal Flow",
      description: "All deal information is protected by legally binding NDAs before any access is granted."
    },
    {
      icon: Star,
      title: "Platform-Verified Reviews",
      description: "Only verified investors who've completed transactions can leave reviews, preventing manipulation."
    },
    {
      icon: FileText,
      title: "Complete Audit Trails",
      description: "Every interaction, document access, and communication is logged for security and compliance."
    },
    {
      icon: Users,
      title: "Investor-First Network",
      description: "Agents are selected specifically for their track record of protecting investor interests."
    },
    {
      icon: Zap,
      title: "Instant Match",
      description: "Connect with pre-vetted agents in your target markets within minutes, not weeks."
    }
  ];

  const stats = [
    { value: "500+", label: "Verified Agents" },
    { value: "2,000+", label: "Protected Deals" },
    { value: "98%", label: "Satisfaction Rate" },
    { value: "$1.2B+", label: "Transaction Volume" }
  ];

  const trustBadges = [
    "256-bit Encryption",
    "SOC 2 Compliant",
    "GDPR Ready",
    "24/7 Security Monitoring"
  ];

  return (
    <div className="overflow-hidden">
      {/* Onboarding Banner - show if signed in but not onboarded */}
      {user && !onboarded && (
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white py-4 sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Complete your onboarding to unlock matches</p>
                  <p className="text-sm text-orange-100">Tell us about yourself and start connecting with verified professionals</p>
                </div>
              </div>
              <Button 
                size="sm" 
                className="bg-white text-orange-600 hover:bg-orange-50 font-semibold"
                onClick={() => navigate(createPageUrl("Onboarding"))}
              >
                Finish Onboarding
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white py-20 md:py-32">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUgMCAwNSkiLz48L2c+PC9zdmc+')] opacity-20"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Verified agents.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Protected deal flow.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed">
              AgentVault connects investors with vetted, investor-friendly agents—backed by verified reviews, NDAs, and an auditable activity log.
            </p>

            {/* Three Proof Points */}
            <div className="grid md:grid-cols-3 gap-6 mb-12 text-left">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <CheckCircle className="w-8 h-8 text-emerald-400 mb-3" />
                <h3 className="font-semibold text-lg mb-2">Verified Licenses</h3>
                <p className="text-slate-300 text-sm">License verification, background checks, reference validation, and track record analysis.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <Lock className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="font-semibold text-lg mb-2">NDA-Gated Rooms</h3>
                <p className="text-slate-300 text-sm">All deal information requires legally binding NDA signatures before access.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <Star className="w-8 h-8 text-yellow-400 mb-3" />
                <h3 className="font-semibold text-lg mb-2">Transparent Reviews</h3>
                <p className="text-slate-300 text-sm">Platform-verified reviews from confirmed transactions prevent manipulation.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 h-14 w-full sm:w-auto"
                onClick={handleGetMatched}
              >
                Get Matched
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Link to={createPageUrl("Pricing")}>
                <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-white/20 hover:bg-white/10 text-white w-full sm:w-auto">
                  See Pricing
                </Button>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-4 mt-12">
              {trustBadges.map((badge) => (
                <div key={badge} className="flex items-center gap-2 text-sm text-slate-400">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-slate-600 text-sm md:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Built for Investor Protection
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Every feature designed to prevent deal manipulation and protect your investment interests.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role Split Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* For Investors */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 md:p-12 border border-blue-200">
              <TrendingUp className="w-12 h-12 text-blue-600 mb-6" />
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">For Investors</h3>
              <p className="text-slate-600 mb-6 text-lg">
                Access a curated network of pre-vetted agents who specialize in protecting investor interests.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">Browse verified agent profiles with authentic reviews</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">NDA-protected deal rooms for secure collaboration</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">Complete audit trails of all interactions</span>
                </li>
              </ul>
              <Link to={createPageUrl("Investors")}>
                <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                  Learn More for Investors
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* For Agents */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-8 md:p-12 border border-emerald-200">
              <Users className="w-12 h-12 text-emerald-600 mb-6" />
              <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">For Agents</h3>
              <p className="text-slate-600 mb-6 text-lg">
                Join a selective network of investor-focused agents and gain access to serious buyers.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">Free membership after vetting approval</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">Access to serious, pre-qualified investors</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">Build reputation through verified reviews</span>
                </li>
              </ul>
              <Link to={createPageUrl("Agents")}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 w-full">
                  Apply as an Agent
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-6 text-blue-400" />
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Protect Your Deal Flow?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of investors and agents who trust AgentVault for secure, verified real estate connections.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 h-14 w-full sm:w-auto"
              onClick={() => {
                handleGetStarted();
                if (window.gtag) window.gtag('event', 'signup_started', { method: 'Bottom CTA' });
              }}
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Link to={createPageUrl("Contact")}>
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-white/20 hover:bg-white/10 text-white w-full sm:w-auto">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
