
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Shield, FileText, TrendingUp, CheckCircle,
  AlertCircle, Building, Award, MapPin, ArrowRight, Star, Mail, X
} from "lucide-react";
import { useState, useEffect } from "react";

/**
 * AGENT DASHBOARD - Fixed KYC Verification Banners
 * 
 * Uses needsKyc flag to show verification banner correctly
 * Routes to Persona/KYC page, not onboarding
 */
export default function AgentHome() {
  const navigate = useNavigate();
  const { 
    profile, 
    loading, 
    onboarded, 
    user,
    kycVerified,
    needsKyc,
    needsOnboarding,
    hasNDA,
    targetState
  } = useCurrentProfile();
  
  const [dismissedLicenseBanner, setDismissedLicenseBanner] = useState(false);

  // Suggested investors state (simple fallback for now)
  const [suggestedInvestors, setSuggestedInvestors] = useState([]);
  const [loadingSuggestedInvestors, setLoadingSuggestedInvestors] = useState(true);

  // Check if user is admin
  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  // Load suggested investors when profile is ready
  useEffect(() => {
    let cancelled = false;

    const fetchSuggested = async () => {
      if (!loading && user && profile?.user_role === 'agent' && onboarded && kycVerified) {
        await loadSuggestedInvestors();
      } else if (!loading && !cancelled) {
        setLoadingSuggestedInvestors(false);
      }
    };
    
    fetchSuggested();

    return () => {
      cancelled = true;
    };
  }, [loading, user, profile, onboarded, kycVerified, targetState]); // Added targetState as a dependency

  const loadSuggestedInvestors = async () => {
    let cancelled = false;

    try {
      setLoadingSuggestedInvestors(true);

      // Simple fallback: Get verified investors in agent's markets
      // Assuming 'base44' is globally available or imported if not defined in this snippet.
      // In a real application, 'base44' would be imported or provided via context.
      const allProfiles = await base44.entities.Profile.filter({});
      
      const investorProfiles = allProfiles
        .filter(p => 
          p.user_role === 'investor' &&
          p.onboarding_version === 'v2' &&
          p.onboarding_completed_at &&
          (!targetState || p.target_state === targetState || p.markets?.includes(targetState))
        )
        .slice(0, 6); // Limit to 6 investors

      if (!cancelled) {
        setSuggestedInvestors(investorProfiles);
      }
    } catch (err) {
      console.warn("[AgentHome] Failed to load suggested investors", err);
      if (!cancelled) setSuggestedInvestors([]);
    } finally {
      if (!cancelled) setLoadingSuggestedInvestors(false);
    }

    return () => {
      cancelled = true;
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  const agentData = profile?.agent || {};
  const docs = agentData.documents || [];
  
  // Check if license is missing or unverified
  const needsLicense = 
    !agentData.license_number || 
    !agentData.license_state || 
    agentData.verification_status !== 'verified';

  // Handler for starting KYC verification
  const handleStartKyc = () => {
    if (!user) {
      // Assuming 'base44' is globally available or imported if not defined in this snippet.
      base44.auth.redirectToLogin(createPageUrl("PostAuth"));
      return;
    }

    // If onboarding not finished, send to onboarding
    if (needsOnboarding) {
      navigate(createPageUrl("AgentOnboarding"));
      return;
    }

    // If onboarding done but KYC not verified, go to Persona
    if (needsKyc) {
      navigate(createPageUrl("Verify"));
      return;
    }

    // Already verified - do nothing or show toast
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-10 h-10" />
                <h1 className="text-4xl font-bold">Your Agent Dashboard</h1>
              </div>
              <p className="text-emerald-100 text-lg">
                Welcome back, {profile?.full_name || 'Agent'}! Connect with serious investors and grow your business.
              </p>
              
              {/* Metric Pills */}
              <div className="flex gap-4 mt-6 flex-wrap">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">
                    Identity: <strong>{kycVerified ? 'Verified ✅' : 'Pending'}</strong>
                  </span>
                </div>
                <div className={`backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2 ${
                  hasNDA ? 'bg-emerald-500/20 border border-emerald-400/30' : 'bg-red-500/20 border border-red-400/30'
                }`}>
                  <Shield className="w-4 h-4" />
                  <span className="text-sm">
                    NDA: <strong>{hasNDA ? 'Signed ✅' : 'Required'}</strong>
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">
                    Deals Closed: <strong>0</strong>
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Last updated: <strong>{new Date(profile?.updated_date || Date.now()).toLocaleDateString()}</strong>
                  </span>
                </div>
              </div>
            </div>
            
            {/* Admin Button - Only visible to admins */}
            {isAdmin && (
              <Button
                onClick={() => navigate(createPageUrl("Admin"))}
                className="bg-orange-600 hover:bg-orange-700 gap-2"
              >
                <Shield className="w-4 h-4" />
                Admin Panel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Onboarding Banner */}
        {needsOnboarding && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-orange-900 mb-2">
                  Complete your agent onboarding
                </h3>
                <p className="text-orange-800 mb-4 text-base">
                  We've updated our onboarding for investor-friendly agents. Please complete the new questions so we can verify your profile and match you with the right investors.
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl("AgentOnboarding"))}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                  size="lg"
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Continue onboarding
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* KYC Verification Banner - ONLY show if onboarded but not verified */}
        {onboarded && needsKyc && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <Award className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">Verify Your Identity</h3>
                <p className="text-orange-800 mb-4">
                  Complete identity verification to access investor profiles and appear in search results. Required for platform security.
                </p>
                <Button 
                  onClick={handleStartKyc}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Start Identity Verification
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* License Banner - Show if license missing/unverified */}
        {onboarded && needsLicense && !dismissedLicenseBanner && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8 relative">
            <button
              onClick={() => setDismissedLicenseBanner(true)}
              className="absolute top-4 right-4 text-blue-600 hover:text-blue-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-start gap-4 pr-8">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2">Verify your real estate license</h3>
                <p className="text-blue-800 mb-4">
                  {!agentData.license_number ? 
                    "Add your license number and state to unlock full credibility and future verification." :
                    "Your license is pending verification. We'll notify you once verified."
                  }
                </p>
                <Link to={createPageUrl("AccountProfile")}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Shield className="w-4 h-4 mr-2" />
                    {!agentData.license_number ? 'Add License' : 'Update License'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* NDA Required Banner */}
        {onboarded && kycVerified && !hasNDA && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">NDA Required</h3>
                <p className="text-orange-800 mb-4">
                  You need to accept our Non-Disclosure Agreement to access investor profiles and deal rooms.
                </p>
                <Link to={createPageUrl("NDA")}>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    <Shield className="w-4 h-4 mr-2" />
                    Sign NDA
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* My Profile */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                <h2 className="text-xl font-bold text-slate-900">My Profile</h2>
              </div>
              <Link to={createPageUrl("AccountProfile")}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </div>
            
            <div className="space-y-4">
              {agentData.brokerage && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Brokerage</p>
                  <p className="font-semibold text-slate-900">{agentData.brokerage}</p>
                </div>
              )}
              
              {agentData.license_number && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">License Number</p>
                  <p className="font-semibold text-slate-900">{agentData.license_number}</p>
                  {agentData.license_state && (
                    <Badge variant="secondary" className="mt-1">
                      {agentData.license_state}
                    </Badge>
                  )}
                </div>
              )}
              
              {agentData.experience_years !== undefined && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Experience</p>
                  <p className="font-semibold text-slate-900">{agentData.experience_years} years</p>
                </div>
              )}
              
              {agentData.investor_clients_count !== undefined && (
                <div>
                  <p className="text-sm text-slate-600 mb-1">Investor Clients</p>
                  <p className="font-semibold text-slate-900">{agentData.investor_clients_count}+</p>
                </div>
              )}
              
              {agentData.markets && agentData.markets.length > 0 && (
                <div>
                  <p className="text-sm text-slate-600 mb-2">Markets</p>
                  <div className="flex flex-wrap gap-2">
                    {agentData.markets.slice(0, 5).map((market, idx) => (
                      <Badge key={idx} variant="secondary">
                        <MapPin className="w-3 h-3 mr-1" />
                        {market}
                      </Badge>
                    ))}
                    {agentData.markets.length > 5 && (
                      <Badge variant="secondary">+{agentData.markets.length - 5} more</Badge>
                    )}
                  </div>
                </div>
              )}
              
              {agentData.specialties && agentData.specialties.length > 0 && (
                <div>
                  <p className="text-sm text-slate-600 mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {agentData.specialties.slice(0, 3).map((spec, idx) => (
                      <Badge key={idx} variant="secondary">{spec}</Badge>
                    ))}
                    {agentData.specialties.length > 3 && (
                      <Badge variant="secondary">+{agentData.specialties.length - 3} more</Badge>
                    )}
                  </div>
                </div>
              )}

              {(!agentData.markets || agentData.markets.length === 0) && (
                <div className="text-center py-8">
                  <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 mb-3">Complete your agent profile</p>
                  <Link to={createPageUrl("AccountProfile")}>
                    <Button size="sm">Edit Profile</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Suggested Investors - FIXED */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-slate-800">Suggested Investors</h3>
                <p className="text-xs text-slate-500">
                  Investors whose profiles align with your markets and strategy.
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-slate-700 hover:text-slate-900"
                onClick={() => navigate(createPageUrl("InvestorDirectory"))}
              >
                View All
              </button>
            </div>

            {loadingSuggestedInvestors ? (
              <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-500">
                <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin mb-3" />
                <div>Analyzing investor demand…</div>
                <div className="mt-1">We&apos;re surfacing investors that fit your focus.</div>
              </div>
            ) : needsOnboarding ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                <p className="text-slate-600 mb-3 text-xs">Complete onboarding to access investors</p>
                <Button size="sm" onClick={() => navigate(createPageUrl("AgentOnboarding"))}>
                  Complete Onboarding
                </Button>
              </div>
            ) : needsKyc ? (
              <div className="text-center py-8">
                <Shield className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                <p className="text-slate-600 mb-3 text-xs">Verify identity to access investors</p>
                <Button size="sm" onClick={handleStartKyc}>
                  Verify Identity
                </Button>
              </div>
            ) : suggestedInvestors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-500">
                <p className="mb-3 text-center">
                  No suggested investors yet. While we improve matching, you can browse the full investor directory.
                </p>
                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-black text-white text-xs font-medium"
                  onClick={() => navigate(createPageUrl("InvestorDirectory"))}
                >
                  Browse all investors
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestedInvestors.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {inv.full_name || 'Investor'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {inv.target_state || inv.markets?.[0] || 'Market not set'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      onClick={() => navigate(`${createPageUrl("InvestorDirectory")}?highlight=${inv.id}`)}
                    >
                      View profile
                    </button>
                  </div>
                ))}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    className="inline-flex items-center text-xs text-slate-700 hover:text-slate-900"
                    onClick={() => navigate(createPageUrl("InvestorDirectory"))}
                  >
                    <span className="mr-1">Find matches now</span>
                    <span className="text-slate-400">↗</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-bold text-slate-900">Documents</h2>
              </div>
              <Link to={createPageUrl("AgentDocuments")}>
                <Button variant="outline" size="sm">Manage</Button>
              </Link>
            </div>
            
            {docs.length > 0 ? (
              <div className="space-y-2">
                {docs.slice(0, 3).map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{doc.type}</p>
                    </div>
                  </div>
                ))}
                {docs.length > 3 && (
                  <p className="text-xs text-slate-500 text-center pt-2">
                    +{docs.length - 3} more documents
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">Upload license & resume</p>
                <Link to={createPageUrl("AgentDocuments")}>
                  <Button size="sm">Upload Documents</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Links</h2>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3"
                onClick={() => navigate(createPageUrl("InvestorDirectory"))}
              >
                <Users className="w-4 h-4 text-blue-600" />
                Browse Investors
              </Button>
              <Link to={createPageUrl("DealRooms")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Deal Rooms
                </Button>
              </Link>
              <Link to={createPageUrl("Inbox")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Mail className="w-4 h-4 text-slate-600" />
                  Messages
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Agent Benefits */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Why AgentVault?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Free Membership</h3>
              <p className="text-sm text-slate-600">No fees to join or use AgentVault. Always free for agents.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Qualified Investors</h3>
              <p className="text-sm text-slate-600">Connect with serious, pre-vetted investors only.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Build Reputation</h3>
              <p className="text-sm text-slate-600">Earn verified reviews and grow your business.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
