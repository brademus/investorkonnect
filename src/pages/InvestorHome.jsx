import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { embedProfile, matchAgentsForInvestor } from "@/components/functions";
import { SetupChecklist } from "@/components/SetupChecklist";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Shield, FileText, Users, CheckCircle,
  AlertCircle, Target, DollarSign, ArrowRight, Star,
  Loader2, MapPin, User, Plus, Sparkles
} from "lucide-react";
import { toast } from "sonner";

export default function InvestorHome() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    subscriptionPlan,
    subscriptionStatus,
    isPaidSubscriber,
    isInvestorReady,
    loading: profileLoading,
    targetState
  } = useCurrentProfile();

  const [suggestedAgents, setSuggestedAgents] = useState([]);
  const [loadingSuggestedAgents, setLoadingSuggestedAgents] = useState(true);

  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  useEffect(() => {
    // Load AI matches for any investor with a profile, even if not fully ready
    if (!profileLoading && user && profile?.user_role === 'investor') {
      loadAIMatches();
    } else if (!profileLoading) {
      setLoadingSuggestedAgents(false);
    }
  }, [profileLoading, user, profile]);

  const loadAIMatches = async () => {
    let cancelled = false;
    try {
      setLoadingSuggestedAgents(true);
      
      // Try embedding first (may fail for incomplete profiles, that's OK)
      try {
        await embedProfile();
      } catch (embErr) {
        console.log('Embedding skipped:', embErr.message);
      }
      
      // Try AI-powered matching first
      let results = [];
      try {
        const aiResponse = await findBestAgents({ limit: 6 });
        if (aiResponse.data?.ok && aiResponse.data?.results?.length > 0) {
          results = aiResponse.data.results;
        }
      } catch (aiErr) {
        console.log('AI matching failed, trying fallback:', aiErr.message);
      }
      
      // Fallback to embedding-based matching
      if (results.length === 0) {
        const matchResponse = await matchAgentsForInvestor({ limit: 6 });
        if (matchResponse.data?.ok) {
          results = matchResponse.data.results || [];
        }
      }
      
      if (!cancelled) {
        setSuggestedAgents(results);
      }
    } catch (err) {
      console.error("Failed to load agent matches:", err);
      if (!cancelled) setSuggestedAgents([]);
    } finally {
      if (!cancelled) setLoadingSuggestedAgents(false);
    }
    return () => { cancelled = true; };
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const getPlanName = (plan) => {
    const names = { 'starter': 'Starter', 'pro': 'Pro', 'enterprise': 'Enterprise', 'none': 'Free' };
    return names[plan] || 'Free';
  };

  const hasNDA = profile?.nda_accepted;
  const buyBox = profile?.investor?.buy_box || {};
  const docs = profile?.investor?.documents || [];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Header */}
      <header className="border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Logo size="default" showText={true} linkTo={createPageUrl("DashboardInvestor")} />
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button onClick={() => navigate(createPageUrl("Admin"))} className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] shadow-sm hover:border-[#D3A029] hover:shadow-md transition-all">
                  <Shield className="w-4 h-4" /> Admin
                </button>
              )}
              <Link to={createPageUrl("MyProfile")}>
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
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#111827] tracking-tight">
                Your Investor Dashboard
              </h1>
              <p className="mt-2 text-lg text-[#6B7280]">
                See your buy box, suggested agents, and deal tools in one place.
              </p>
            </div>
            <Button
              onClick={() => navigate(createPageUrl("DealWizard"))}
              className="bg-[#D3A029] hover:bg-[#B8902A] text-white shadow-lg shadow-[#D3A029]/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              Submit New Deal
            </Button>
          </div>

          {/* Setup Checklist */}
          <SetupChecklist profile={profile} onRefresh={() => window.location.reload()} />

          {/* Subscription Banner */}
          {isPaidSubscriber ? (
            <section className="rounded-2xl border border-[#FCD34D] bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#D3A029] flex items-center justify-center shadow-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#111827]">{getPlanName(subscriptionPlan)} Plan Active</h2>
                    <p className="text-sm text-[#92400E]">
                      {subscriptionStatus === 'trialing' ? 'Free trial active' : 'Full access to all features'}
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate(createPageUrl("Pricing"))} className="inline-flex items-center justify-center rounded-full border-2 border-[#D3A029] bg-white px-6 py-2.5 text-sm font-semibold text-[#92400E] shadow-sm hover:bg-[#FFFBEB] transition-all">
                  Manage plan
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-[#FCD34D] bg-gradient-to-r from-[#FFFBEB] to-[#FEF3C7] p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#D3A029] flex items-center justify-center shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#111827]">Upgrade to unlock full platform access</h2>
                    <p className="text-sm text-[#92400E]">Get unlimited deal rooms, advanced analytics, and priority support.</p>
                  </div>
                </div>
                <button onClick={() => navigate(createPageUrl("Pricing"))} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#D3A029]/30 hover:bg-[#B98413] hover:shadow-xl transition-all">
                  View plans <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* NDA Banner */}
          {!hasNDA && (
            <section className="rounded-2xl border border-[#FECACA] bg-gradient-to-r from-[#FEF2F2] to-[#FEE2E2] p-6 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#FCA5A5] flex items-center justify-center">
                    <Shield className="w-6 h-6 text-[#991B1B]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#991B1B]">NDA Required</h2>
                    <p className="text-sm text-[#B91C1C]">Accept our NDA to access agent profiles and deal rooms.</p>
                  </div>
                </div>
                <Link to={createPageUrl("NDA")}>
                  <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#DC2626] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#B91C1C] transition-all">
                    Sign NDA <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </section>
          )}

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Suggested Agents */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
                <header className="flex items-center justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-[#111827]">Suggested Agents</h2>
                      <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-medium text-[#92400E]">AI Powered</span>
                    </div>
                    <p className="text-sm text-[#6B7280] mt-1">AI-powered matches based on your investment goals.</p>
                  </div>
                  <button onClick={() => navigate(createPageUrl("AgentDirectory"))} className="text-sm font-medium text-[#D3A029] hover:text-[#B98413] transition-colors">View all →</button>
                </header>

                {loadingSuggestedAgents ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[#D3A029] mb-3" />
                    <p className="text-sm text-[#6B7280]">AI is analyzing your profile...</p>
                  </div>
                ) : suggestedAgents.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="w-12 h-12 text-[#E5E7EB] mx-auto mb-3" />
                    <p className="text-sm text-[#6B7280]">No AI matches yet. Complete your profile for better matching.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[#F3F4F6]">
                    {suggestedAgents.slice(0, 4).map(({ profile: agent, score }) => (
                      <li key={agent.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-[#9CA3AF]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-[#111827] truncate">{agent.full_name || 'Agent'}</p>
                              {score && score >= 0.8 && <span className="inline-flex items-center rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">Top</span>}
                            </div>
                            <p className="text-sm text-[#6B7280] truncate">
                              {agent.agent?.markets?.[0] || agent.target_state || 'Market not set'}
                              {score && ` • ${(score * 100).toFixed(0)}% match`}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => navigate(`${createPageUrl("AgentDirectory")}?highlight=${agent.id}`)} className="inline-flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#D3A029] hover:shadow-sm transition-all flex-shrink-0">
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Documents */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
                <header className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[#111827]">Documents</h2>
                  {docs.length > 0 && (
                    <Link to={createPageUrl("InvestorDocuments")}>
                      <button className="text-sm font-medium text-[#D3A029] hover:text-[#B98413] transition-colors">Manage →</button>
                    </Link>
                  )}
                </header>

                {docs.length > 0 ? (
                  <ul className="space-y-3">
                    {docs.slice(0, 3).map((doc, idx) => (
                      <li key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
                        <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#6B7280]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#111827] truncate">{doc.name}</p>
                          <p className="text-sm text-[#6B7280] capitalize">{doc.type}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
                    <div className="w-12 h-12 rounded-xl bg-[#E5E7EB] flex items-center justify-center">
                      <FileText className="w-6 h-6 text-[#9CA3AF]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#374151]">No documents uploaded yet</p>
                      <Link to={createPageUrl("InvestorDocuments")}>
                        <button className="text-sm font-medium text-[#D3A029] hover:text-[#B98413] transition-colors">Upload documents →</button>
                      </Link>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Buy Box */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
                <header className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#111827]">Buy Box</h2>
                    <p className="text-sm text-[#6B7280] mt-1">Snapshot of what you're looking to buy.</p>
                  </div>
                  <Link to={createPageUrl("InvestorBuyBox")}>
                    <button className="text-sm font-medium text-[#D3A029] hover:text-[#B98413] transition-colors">Edit →</button>
                  </Link>
                </header>

                {buyBox.asset_types || buyBox.markets || buyBox.min_budget ? (
                  <dl className="space-y-4">
                    {buyBox.asset_types?.length > 0 && (
                      <div>
                        <dt className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-2">Asset types</dt>
                        <dd className="flex flex-wrap gap-2">
                          {buyBox.asset_types.map((type, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-sm font-medium text-[#374151]">{type}</span>
                          ))}
                        </dd>
                      </div>
                    )}
                    {buyBox.markets?.length > 0 && (
                      <div>
                        <dt className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-2">Target markets</dt>
                        <dd className="flex flex-wrap gap-2">
                          {buyBox.markets.map((market, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 text-sm font-medium text-[#374151]">{market}</span>
                          ))}
                        </dd>
                      </div>
                    )}
                    {(buyBox.min_budget || buyBox.max_budget) && (
                      <div>
                        <dt className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-2">Budget range</dt>
                        <dd className="text-xl font-bold text-[#111827]">${buyBox.min_budget?.toLocaleString() || '0'} - ${buyBox.max_budget?.toLocaleString() || '∞'}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
                    <div className="w-12 h-12 rounded-xl bg-[#E5E7EB] flex items-center justify-center">
                      <Target className="w-6 h-6 text-[#9CA3AF]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#374151]">No buy box configured</p>
                      <Link to={createPageUrl("InvestorBuyBox")}>
                        <button className="text-sm font-medium text-[#D3A029] hover:text-[#B98413] transition-colors">Set up buy box →</button>
                      </Link>
                    </div>
                  </div>
                )}
              </section>

              {/* Quick Links */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-lg">
                <h2 className="text-lg font-semibold text-[#111827] mb-4">Quick Links</h2>
                <div className="space-y-2">
                  {[
                    { label: 'Subscription & plans', icon: '💳', href: 'Pricing' },
                    { label: 'My profile', icon: '👤', href: 'MyProfile' },
                    { label: 'Deal rooms', icon: '💬', href: 'DealRooms' },
                    { label: 'Billing & payment', icon: '📑', href: 'Billing' },
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
          </div>
        </div>
      </main>
    </div>
  );
}