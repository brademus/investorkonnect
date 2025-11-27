import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { embedProfile, matchInvestorsForAgent } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Shield, FileText, TrendingUp, CheckCircle,
  AlertCircle, Building, Award, MapPin, ArrowRight, Star, Loader2, User, DollarSign, X
} from "lucide-react";
import { useState, useEffect } from "react";

export default function AgentHome() {
  const navigate = useNavigate();
  const { 
    profile, loading, onboarded, user, kycVerified, needsKyc, needsOnboarding, hasNDA, targetState
  } = useCurrentProfile();
  
  const [dismissedLicenseBanner, setDismissedLicenseBanner] = useState(false);
  const [suggestedInvestors, setSuggestedInvestors] = useState([]);
  const [loadingSuggestedInvestors, setLoadingSuggestedInvestors] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    const fetchSuggested = async () => {
      if (!loading && user && profile?.user_role === 'agent' && onboarded && kycVerified) {
        await loadAIMatches();
      } else if (!loading && !cancelled) {
        setLoadingSuggestedInvestors(false);
      }
    };
    fetchSuggested();
    return () => { cancelled = true; };
  }, [loading, user, profile, onboarded, kycVerified]);

  const loadAIMatches = async () => {
    let cancelled = false;
    try {
      setLoadingSuggestedInvestors(true);
      await embedProfile();
      const matchResponse = await matchInvestorsForAgent({ limit: 6 });
      if (!cancelled && matchResponse.data?.ok) {
        setSuggestedInvestors(matchResponse.data.results || []);
      } else {
        setSuggestedInvestors([]);
      }
    } catch (err) {
      if (!cancelled) setSuggestedInvestors([]);
    } finally {
      if (!cancelled) setLoadingSuggestedInvestors(false);
    }
    return () => { cancelled = true; };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent mx-auto" style={{ borderColor: 'hsl(43 59% 52%)', borderTopColor: 'transparent' }}></div>
          <p className="mt-4 ik-text-muted text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const agentData = profile?.agent || {};
  const docs = agentData.documents || [];
  const needsLicense = !agentData.license_number || !agentData.license_state || agentData.verification_status !== 'verified';

  const handleStartKyc = () => {
    if (!user) { base44.auth.redirectToLogin(createPageUrl("PostAuth")); return; }
    if (needsOnboarding) { navigate(createPageUrl("AgentOnboarding")); return; }
    if (needsKyc) { navigate(createPageUrl("Verify")); return; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8" style={{ color: 'hsl(43 59% 52%)' }} />
            <h1 className="text-2xl sm:text-3xl font-semibold" style={{ color: 'hsl(0 0% 0%)' }}>Your Agent Dashboard</h1>
          </div>
          <p className="ik-text-subtle text-sm sm:text-base">Welcome back, {profile?.full_name || 'Agent'}!</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate(createPageUrl("Admin"))} className="ik-btn-gold gap-2">
            <Shield className="w-4 h-4" /> Admin Panel
          </Button>
        )}
      </header>

      {/* Status Pills */}
      <div className="flex gap-3 flex-wrap">
        <div className="ik-card px-4 py-2 flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: kycVerified ? 'hsl(142 71% 45%)' : 'hsl(43 59% 52%)' }} />
          <span className="text-sm">Identity: <strong>{kycVerified ? 'Verified ✅' : 'Pending'}</strong></span>
        </div>
        <div className="ik-card px-4 py-2 flex items-center gap-2" style={hasNDA ? {} : { borderColor: 'hsl(0 84% 80%)', background: 'hsl(0 100% 98%)' }}>
          <Shield className="w-4 h-4" style={{ color: hasNDA ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)' }} />
          <span className="text-sm">NDA: <strong>{hasNDA ? 'Signed ✅' : 'Required'}</strong></span>
        </div>
      </div>

      {/* Onboarding Banner */}
      {needsOnboarding && (
        <div className="ik-card p-6" style={{ background: 'hsl(30 100% 97%)', borderColor: 'hsl(30 80% 80%)' }}>
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'hsl(30 80% 45%)' }} />
            <div className="flex-1">
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(30 80% 25%)' }}>Complete your agent onboarding</h3>
              <p className="text-sm mb-4" style={{ color: 'hsl(30 60% 35%)' }}>Complete the new questions so we can verify your profile and match you with the right investors.</p>
              <button onClick={() => navigate(createPageUrl("AgentOnboarding"))} className="ik-btn-gold flex items-center gap-2">
                <ArrowRight className="w-4 h-4" /> Continue onboarding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KYC Banner */}
      {onboarded && needsKyc && (
        <div className="ik-card p-6" style={{ background: 'hsl(30 100% 97%)', borderColor: 'hsl(30 80% 80%)' }}>
          <div className="flex items-start gap-4">
            <Award className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'hsl(30 80% 45%)' }} />
            <div className="flex-1">
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(30 80% 25%)' }}>Verify Your Identity</h3>
              <p className="text-sm mb-4" style={{ color: 'hsl(30 60% 35%)' }}>Complete identity verification to access investor profiles and appear in search results.</p>
              <button onClick={handleStartKyc} className="ik-btn-gold flex items-center gap-2">
                <Shield className="w-4 h-4" /> Start Identity Verification <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* License Banner */}
      {onboarded && needsLicense && !dismissedLicenseBanner && (
        <div className="ik-card p-6 relative" style={{ background: 'hsl(217 91% 97%)', borderColor: 'hsl(217 91% 85%)' }}>
          <button onClick={() => setDismissedLicenseBanner(true)} className="absolute top-4 right-4" style={{ color: 'hsl(217 91% 60%)' }}>
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-start gap-4 pr-8">
            <Shield className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'hsl(217 91% 60%)' }} />
            <div className="flex-1">
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(217 91% 25%)' }}>Verify your real estate license</h3>
              <p className="text-sm mb-4" style={{ color: 'hsl(217 60% 35%)' }}>
                {!agentData.license_number ? "Add your license number and state to unlock full credibility." : "Your license is pending verification."}
              </p>
              <Link to={createPageUrl("AccountProfile")}>
                <button className="ik-btn-gold flex items-center gap-2">
                  <Shield className="w-4 h-4" /> {!agentData.license_number ? 'Add License' : 'Update License'} <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* NDA Banner */}
      {onboarded && kycVerified && !hasNDA && (
        <div className="ik-card p-6" style={{ background: 'hsl(30 100% 97%)', borderColor: 'hsl(30 80% 80%)' }}>
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'hsl(30 80% 45%)' }} />
            <div className="flex-1">
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(30 80% 25%)' }}>NDA Required</h3>
              <p className="text-sm mb-4" style={{ color: 'hsl(30 60% 35%)' }}>Accept our Non-Disclosure Agreement to access investor profiles and deal rooms.</p>
              <Link to={createPageUrl("NDA")}>
                <button className="ik-btn-gold flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Sign NDA <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Profile */}
        <div className="ik-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5" style={{ color: 'hsl(43 71% 42%)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>My Profile</h2>
            </div>
            <Link to={createPageUrl("AccountProfile")}><button className="ik-btn-pill text-xs">Edit</button></Link>
          </div>
          
          <div className="space-y-4">
            {agentData.brokerage && <div><p className="text-xs ik-text-muted mb-1">Brokerage</p><p className="font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>{agentData.brokerage}</p></div>}
            {agentData.license_number && (
              <div>
                <p className="text-xs ik-text-muted mb-1">License Number</p>
                <p className="font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>{agentData.license_number}</p>
                {agentData.license_state && <Badge variant="secondary" className="mt-1">{agentData.license_state}</Badge>}
              </div>
            )}
            {agentData.experience_years !== undefined && <div><p className="text-xs ik-text-muted mb-1">Experience</p><p className="font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>{agentData.experience_years} years</p></div>}
            {agentData.markets?.length > 0 && (
              <div>
                <p className="text-xs ik-text-muted mb-2">Markets</p>
                <div className="flex flex-wrap gap-2">
                  {agentData.markets.slice(0, 5).map((market, idx) => <Badge key={idx} variant="secondary"><MapPin className="w-3 h-3 mr-1" />{market}</Badge>)}
                  {agentData.markets.length > 5 && <Badge variant="secondary">+{agentData.markets.length - 5} more</Badge>}
                </div>
              </div>
            )}
            {(!agentData.markets || agentData.markets.length === 0) && (
              <div className="text-center py-8">
                <Building className="w-12 h-12 mx-auto mb-3" style={{ color: 'hsl(0 0% 87%)' }} />
                <p className="text-sm ik-text-muted mb-3">Complete your agent profile</p>
                <Link to={createPageUrl("AccountProfile")}><button className="ik-btn-gold text-xs px-4 py-2">Edit Profile</button></Link>
              </div>
            )}
          </div>
        </div>

        {/* Suggested Investors */}
        <div className="ik-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Suggested Investors</h3>
                <span className="ik-badge-gold text-xs">AI Powered</span>
              </div>
              <p className="text-xs ik-text-muted mt-1">Smart matches based on your markets and expertise</p>
            </div>
            <button onClick={() => navigate(createPageUrl("InvestorDirectory"))} className="text-xs font-medium" style={{ color: 'hsl(43 71% 42%)' }}>View All</button>
          </div>

          {loadingSuggestedInvestors ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: 'hsl(270 60% 55%)' }} />
              <div className="text-xs ik-text-muted font-medium">AI is analyzing investor demand...</div>
            </div>
          ) : needsOnboarding ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: 'hsl(30 80% 60%)' }} />
              <p className="text-xs ik-text-muted mb-3">Complete onboarding to access investors</p>
              <button onClick={() => navigate(createPageUrl("AgentOnboarding"))} className="ik-btn-gold text-xs px-4 py-2">Complete Onboarding</button>
            </div>
          ) : needsKyc ? (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: 'hsl(30 80% 60%)' }} />
              <p className="text-xs ik-text-muted mb-3">Verify identity to access investors</p>
              <button onClick={handleStartKyc} className="ik-btn-gold text-xs px-4 py-2">Verify Identity</button>
            </div>
          ) : suggestedInvestors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="w-12 h-12 mb-3" style={{ color: 'hsl(0 0% 87%)' }} />
              <p className="text-xs ik-text-muted mb-3 text-center">No AI matches yet. Complete your profile for better matching.</p>
              <button onClick={() => navigate(createPageUrl("InvestorDirectory"))} className="ik-btn-gold text-xs px-4 py-2">Browse all investors</button>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestedInvestors.map(({ profile: inv, score }) => (
                <div key={inv.id} className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>{inv.full_name || 'Investor'}</span>
                      {score && score >= 0.8 && <span className="ik-badge-gold text-xs">Top Match</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs ik-text-muted mt-1">
                      <span>{inv.target_state || inv.markets?.[0] || 'Market not set'}</span>
                      {score && <Badge variant="outline" className="text-xs">{(score * 100).toFixed(0)}% match</Badge>}
                    </div>
                  </div>
                  <button onClick={() => navigate(`${createPageUrl("InvestorDirectory")}?highlight=${inv.id}`)} className="text-xs font-medium" style={{ color: 'hsl(43 71% 42%)' }}>View profile</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="ik-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: 'hsl(270 60% 55%)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Documents</h2>
            </div>
            <Link to={createPageUrl("AgentDocuments")}><button className="ik-btn-pill text-xs">Manage</button></Link>
          </div>
          
          {docs.length > 0 ? (
            <div className="space-y-2">
              {docs.slice(0, 3).map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'hsl(0 0% 98%)' }}>
                  <FileText className="w-4 h-4 ik-text-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'hsl(0 0% 10%)' }}>{doc.name}</p>
                    <p className="text-xs ik-text-muted capitalize">{doc.type}</p>
                  </div>
                </div>
              ))}
              {docs.length > 3 && <p className="text-xs ik-text-muted text-center pt-2">+{docs.length - 3} more documents</p>}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'hsl(0 0% 87%)' }} />
              <p className="text-sm ik-text-muted mb-3">Upload license & resume</p>
              <Link to={createPageUrl("AgentDocuments")}><button className="ik-btn-gold text-xs px-4 py-2">Upload Documents</button></Link>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="ik-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(0 0% 10%)' }}>Quick Links</h2>
          <div className="space-y-2">
            <Link to={createPageUrl("Pricing")} className="ik-card ik-card-hover flex items-center gap-3 p-3">
              <Star className="w-4 h-4" style={{ color: 'hsl(43 71% 42%)' }} /> <span className="text-sm font-medium">Subscription & Plans</span>
            </Link>
            <Link to={createPageUrl("AccountProfile")} className="ik-card ik-card-hover flex items-center gap-3 p-3">
              <User className="w-4 h-4 ik-text-muted" /> <span className="text-sm font-medium">My Profile</span>
            </Link>
            <Link to={createPageUrl("InvestorDirectory")} className="ik-card ik-card-hover flex items-center gap-3 p-3">
              <Users className="w-4 h-4" style={{ color: 'hsl(43 71% 42%)' }} /> <span className="text-sm font-medium">Browse Investors</span>
            </Link>
            <Link to={createPageUrl("DealRooms")} className="ik-card ik-card-hover flex items-center gap-3 p-3">
              <FileText className="w-4 h-4" style={{ color: 'hsl(270 60% 55%)' }} /> <span className="text-sm font-medium">Deal Rooms</span>
            </Link>
            <Link to={createPageUrl("Billing")} className="ik-card ik-card-hover flex items-center gap-3 p-3">
              <DollarSign className="w-4 h-4" style={{ color: 'hsl(142 71% 45%)' }} /> <span className="text-sm font-medium">Billing & Payment</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Agent Benefits */}
      <div className="ik-card p-6">
        <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(0 0% 10%)' }}>Why Investor Konnect?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'hsl(48 100% 95%)' }}>
              <CheckCircle className="w-5 h-5" style={{ color: 'hsl(43 71% 42%)' }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(0 0% 10%)' }}>Free Membership</h3>
            <p className="text-sm ik-text-muted">No fees to join or use Investor Konnect. Always free for agents.</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'hsl(48 100% 95%)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: 'hsl(43 71% 42%)' }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(0 0% 10%)' }}>Qualified Investors</h3>
            <p className="text-sm ik-text-muted">Connect with serious, pre-vetted investors only.</p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'hsl(48 100% 95%)' }}>
              <Star className="w-5 h-5" style={{ color: 'hsl(43 71% 42%)' }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: 'hsl(0 0% 10%)' }}>Build Reputation</h3>
            <p className="text-sm ik-text-muted">Earn verified reviews and grow your business.</p>
          </div>
        </div>
      </div>
    </div>
  );
}