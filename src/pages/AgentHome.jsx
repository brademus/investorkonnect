import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { embedProfile, matchInvestorsForAgent } from "@/components/functions";
import { SetupChecklist } from "@/components/SetupChecklist";
import { Logo } from "@/components/Logo";
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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const agentData = profile?.agent || {};
  const docs = agentData.documents || [];
  const needsLicense = !agentData.license_number || !agentData.license_state || agentData.verification_status !== 'verified';

  const handleStartKyc = () => {
    if (!user || !profile) { base44.auth.redirectToLogin(createPageUrl("AgentHome")); return; }
    if (needsOnboarding) { navigate(createPageUrl("AgentOnboarding")); return; }
    if (needsKyc) { navigate(createPageUrl("Verify")); return; }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <header className="border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Logo size="default" showText={true} linkTo={createPageUrl("Dashboard")} />
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button onClick={() => navigate(createPageUrl("Admin"))} className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] shadow-sm hover:border-[#D3A029] hover:shadow-md transition-all">
                  <Shield className="w-4 h-4" /> Admin
                </button>
              )}
              <Link to={createPageUrl("AccountProfile")}>
                <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-[#E5E7EB] transition-colors">
                  <User className="w-5 h-5 text-[#6B7280]" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:max-w-7xl lg:px-8">
        <div className="space-y-8">
          {/* Page Title */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#111827] tracking-tight">
              Your Agent Dashboard
            </h1>
            <p className="mt-2 text-lg text-[#6B7280]">
              Welcome back, {profile?.full_name || 'Agent'}!
            </p>
          </div>

          {/* Setup Checklist */}
          <SetupChecklist profile={profile} onRefresh={() => window.location.reload()} />

          {/* Status Pills */}
          <div className="flex gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2.5 shadow-sm">
              <Shield className={`w-4 h-4 ${kycVerified ? 'text-[#10B981]' : 'text-[#D3A029]'}`} />
              <span className="text-sm font-medium text-[#374151]">Identity: <strong>{kycVerified ? 'Verified ✅' : 'Pending'}</strong></span>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-sm ${hasNDA ? 'border-[#E5E7EB] bg-white' : 'border-[#FECACA] bg-[#FEF2F2]'}`}>
              <Shield className={`w-4 h-4 ${hasNDA ? 'text-[#10B981]' : 'text-[#DC2626]'}`} />
              <span className="text-sm font-medium text-[#374151]">NDA: <strong>{hasNDA ? 'Signed ✅' : 'Required'}</strong></span>
            </div>
          </div>

          {/* Onboarding Banner */}
          {needsOnboarding && (
            <section className="rounded-2xl border border-[#FECACA] bg-gradient-to-r from-[#FEF2F2] to-[#FEE2E2] p-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FCA5A5] flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-[#991B1B]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#991B1B] mb-2">Complete your agent onboarding</h3>
                  <p className="text-sm text-[#B91C1C] mb-4">Complete the new questions so we can verify your profile and match you with the right investors.</p>
                  <button onClick={() => navigate(createPageUrl("AgentOnboarding"))} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#DC2626] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#B91C1C] transition-all">
                    Continue onboarding <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* KYC Banner */}
          {onboarded && needsKyc && (
            <section className="rounded-2xl border border-[#FCD34D] bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] p-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#D3A029] flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#92400E] mb-2">Verify Your Identity</h3>
                  <p className="text-sm text-[#B45309] mb-4">Complete identity verification to access investor profiles and appear in search results.</p>
                  <button onClick={handleStartKyc} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#D3A029]/30 hover:bg-[#B98413] transition-all">
                    <Shield className="w-4 h-4" /> Start Identity Verification <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* License Banner */}
          {onboarded && needsLicense && !dismissedLicenseBanner && (
            <section className="rounded-2xl border border-[#93C5FD] bg-gradient-to-r from-[#EFF6FF] to-[#DBEAFE] p-6 shadow-md relative">
              <button onClick={() => setDismissedLicenseBanner(true)} className="absolute top-4 right-4 text-[#3B82F6] hover:text-[#1D4ED8]">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-start gap-4 pr-8">
                <div className="w-12 h-12 rounded-xl bg-[#3B82F6] flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#1E40AF] mb-2">Verify your real estate license</h3>
                  <p className="text-sm text-[#1E3A8A] mb-4">
                    {!agentData.license_number ? "Add your license number and state to unlock full credibility." : "Your license is pending verification."}
                  </p>
                  <Link to={createPageUrl("AccountProfile")}>
                    <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#3B82F6] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#2563EB] transition-all">
                      <Shield className="w-4 h-4" /> {!agentData.license_number ? 'Add License' : 'Update License'} <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* NDA Banner */}
          {onboarded && kycVerified && !hasNDA && (
            <section className="rounded-2xl border border-[#FECACA] bg-gradient-to-r from-[#FEF2F2] to-[#FEE2E2] p-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#FCA5A5] flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-[#991B1B]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#991B1B] mb-2">NDA Required</h3>
                  <p className="text-sm text-[#B91C1C] mb-4">Accept our Non-Disclosure Agreement to access investor profiles and deal rooms.</p>
                  <Link to={createPageUrl("NDA")}>
                    <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#DC2626] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#B91C1C] transition-all">
                      <Shield className="w-4 h-4" /> Sign NDA <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Profile */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center">
                    <Building className="w-5 h-5 text-[#D3A029]" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#111827]">My Profile</h2>
                </div>
                <Link to={createPageUrl("AccountProfile")}>
                  <button className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#D3A029] hover:shadow-sm transition-all">Edit</button>
                </Link>
              </div>
              
              <div className="space-y-4">
                {agentData.brokerage && (
                  <div>
                    <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">Brokerage</p>
                    <p className="font-semibold text-[#111827]">{agentData.brokerage}</p>
                  </div>
                )}
                {agentData.license_number && (
                  <div>
                    <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">License Number</p>
                    <p className="font-semibold text-[#111827]">{agentData.license_number}</p>
                    {agentData.license_state && <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#374151] mt-2">{agentData.license_state}</span>}
                  </div>
                )}
                {agentData.experience_years !== undefined && (
                  <div>
                    <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">Experience</p>
                    <p className="font-semibold text-[#111827]">{agentData.experience_years} years</p>
                  </div>
                )}
                {agentData.markets?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-2">Markets</p>
                    <div className="flex flex-wrap gap-2">
                      {agentData.markets.slice(0, 5).map((market, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-medium text-[#374151]">
                          <MapPin className="w-3 h-3" />{market}
                        </span>
                      ))}
                      {agentData.markets.length > 5 && <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-medium text-[#374151]">+{agentData.markets.length - 5} more</span>}
                    </div>
                  </div>
                )}
                {(!agentData.markets || agentData.markets.length === 0) && (
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
                    <p className="text-sm text-[#6B7280] mb-3">Complete your agent profile</p>
                    <Link to={createPageUrl("AccountProfile")}>
                      <button className="inline-flex items-center justify-center rounded-full bg-[#D3A029] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#D3A029]/30 hover:bg-[#B98413] transition-all">Edit Profile</button>
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Suggested Investors */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-[#111827]">Suggested Investors</h3>
                    <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-medium text-[#92400E]">AI Powered</span>
                  </div>
                  <p className="text-sm text-[#6B7280] mt-1">Smart matches based on your markets and expertise</p>
                </div>
                <button onClick={() => navigate(createPageUrl("InvestorDirectory"))} className="text-sm font-medium text-[#D3A029] hover:text-[#B98413] transition-colors">View All →</button>
              </div>

              {loadingSuggestedInvestors ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#D3A029] mb-3" />
                  <div className="text-sm text-[#6B7280]">AI is analyzing investor demand...</div>
                </div>
              ) : needsOnboarding ? (
                <div className="text-center py-10">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[#FCD34D]" />
                  <p className="text-sm text-[#6B7280] mb-3">Complete onboarding to access investors</p>
                  <button onClick={() => navigate(createPageUrl("AgentOnboarding"))} className="inline-flex items-center justify-center rounded-full bg-[#D3A029] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#D3A029]/30 hover:bg-[#B98413] transition-all">Complete Onboarding</button>
                </div>
              ) : needsKyc ? (
                <div className="text-center py-10">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-[#FCD34D]" />
                  <p className="text-sm text-[#6B7280] mb-3">Verify identity to access investors</p>
                  <button onClick={handleStartKyc} className="inline-flex items-center justify-center rounded-full bg-[#D3A029] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#D3A029]/30 hover:bg-[#B98413] transition-all">Verify Identity</button>
                </div>
              ) : suggestedInvestors.length === 0 ? (
                <div className="text-center py-10">
                  <Users className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
                  <p className="text-sm text-[#6B7280] mb-3">No AI matches yet. Complete your profile for better matching.</p>
                  <button onClick={() => navigate(createPageUrl("InvestorDirectory"))} className="inline-flex items-center justify-center rounded-full bg-[#D3A029] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#D3A029]/30 hover:bg-[#B98413] transition-all">Browse all investors</button>
                </div>
              ) : (
                <div className="divide-y divide-[#F3F4F6]">
                  {suggestedInvestors.map(({ profile: inv, score }) => (
                    <div key={inv.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-[#9CA3AF]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#111827] truncate">{inv.full_name || 'Investor'}</span>
                            {score && score >= 0.8 && <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">Top Match</span>}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[#6B7280] mt-0.5">
                            <span>{inv.target_state || inv.markets?.[0] || 'Market not set'}</span>
                            {score && <span className="text-xs bg-[#F3F4F6] px-2 py-0.5 rounded-full">{(score * 100).toFixed(0)}% match</span>}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => navigate(`${createPageUrl("InvestorDirectory")}?highlight=${inv.id}`)} className="text-sm font-medium text-[#D3A029] hover:text-[#B98413] transition-colors flex-shrink-0">View →</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Documents */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#7C3AED]" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#111827]">Documents</h2>
                </div>
                <Link to={createPageUrl("AgentDocuments")}>
                  <button className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#D3A029] hover:shadow-sm transition-all">Manage</button>
                </Link>
              </div>
              
              {docs.length > 0 ? (
                <div className="space-y-3">
                  {docs.slice(0, 3).map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
                      <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center">
                        <FileText className="w-5 h-5 text-[#6B7280]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#111827] truncate">{doc.name}</p>
                        <p className="text-sm text-[#6B7280] capitalize">{doc.type}</p>
                      </div>
                    </div>
                  ))}
                  {docs.length > 3 && <p className="text-sm text-[#6B7280] text-center pt-2">+{docs.length - 3} more documents</p>}
                </div>
              ) : (
                <div className="text-center py-10">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
                  <p className="text-sm text-[#6B7280] mb-3">Upload license & resume</p>
                  <Link to={createPageUrl("AgentDocuments")}>
                    <button className="inline-flex items-center justify-center rounded-full bg-[#D3A029] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#D3A029]/30 hover:bg-[#B98413] transition-all">Upload Documents</button>
                  </Link>
                </div>
              )}
            </section>

            {/* Quick Links */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-[#111827] mb-4">Quick Links</h2>
              <div className="space-y-2">
                {[
                  { label: 'Subscription & Plans', icon: '⭐', href: 'Pricing' },
                  { label: 'My Profile', icon: '👤', href: 'AccountProfile' },
                  { label: 'Browse Investors', icon: '👥', href: 'InvestorDirectory' },
                  { label: 'Deal Rooms', icon: '💬', href: 'DealRooms' },
                  { label: 'Billing & Payment', icon: '💳', href: 'Billing' },
                ].map((link) => (
                  <Link key={link.href} to={createPageUrl(link.href)} className="flex items-center justify-between w-full p-4 rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] hover:border-[#D3A029] hover:bg-[#FFFBEB] transition-all group">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{link.icon}</span>
                      <span className="font-medium text-[#374151] group-hover:text-[#111827]">{link.label}</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#D3A029] transition-colors" />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Agent Benefits */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-[#111827] mb-6">Why Investor Konnect?</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: <CheckCircle className="w-6 h-6 text-[#D3A029]" />, title: 'Free Membership', desc: 'No fees to join or use Investor Konnect. Always free for agents.' },
                { icon: <TrendingUp className="w-6 h-6 text-[#D3A029]" />, title: 'Qualified Investors', desc: 'Connect with serious, pre-vetted investors only.' },
                { icon: <Star className="w-6 h-6 text-[#D3A029]" />, title: 'Build Reputation', desc: 'Earn verified reviews and grow your business.' },
              ].map((item, idx) => (
                <div key={idx} className="text-center sm:text-left">
                  <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center mb-4 mx-auto sm:mx-0">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-[#111827] mb-2">{item.title}</h3>
                  <p className="text-sm text-[#6B7280]">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}