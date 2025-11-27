import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { embedProfile, matchAgentsForInvestor } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Shield, FileText, Users, CheckCircle,
  AlertCircle, Target, DollarSign, ArrowRight, Star,
  Loader2, MapPin, User
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
    if (!profileLoading && user && profile?.user_role === 'investor' && isInvestorReady) {
      loadAIMatches();
    } else if (!profileLoading) {
      setLoadingSuggestedAgents(false);
    }
  }, [profileLoading, user, profile, isInvestorReady]);

  const loadAIMatches = async () => {
    let cancelled = false;
    try {
      setLoadingSuggestedAgents(true);
      await embedProfile();
      const matchResponse = await matchAgentsForInvestor({ limit: 6 });
      if (!cancelled && matchResponse.data?.ok) {
        setSuggestedAgents(matchResponse.data.results || []);
      } else {
        setSuggestedAgents([]);
      }
    } catch (err) {
      toast.error("Failed to load agent matches");
      if (!cancelled) setSuggestedAgents([]);
    } finally {
      if (!cancelled) setLoadingSuggestedAgents(false);
    }
    return () => { cancelled = true; };
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent mx-auto" style={{ borderColor: 'hsl(43 59% 52%)', borderTopColor: 'transparent' }}></div>
          <p className="mt-4 ik-text-muted text-sm">Loading dashboard...</p>
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
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold" style={{ color: 'hsl(0 0% 0%)' }}>
            Your Investor Konnect dashboard
          </h1>
          <p className="ik-text-subtle text-sm sm:text-base mt-1">
            See your buy box, suggested agents, and deal tools in one place.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate(createPageUrl("Admin"))} className="ik-btn-gold gap-2">
            <Shield className="w-4 h-4" /> Admin Panel
          </Button>
        )}
      </header>

      {/* Subscription Banner */}
      {isPaidSubscriber ? (
        <section className="ik-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: 'hsl(48 100% 97%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(43 59% 52%)' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>{getPlanName(subscriptionPlan)} Plan Active</h2>
              <p className="text-xs ik-text-muted mt-0.5">
                {subscriptionStatus === 'trialing' ? 'Free trial active' : 'Full access to all features'}
              </p>
            </div>
          </div>
          <button onClick={() => navigate(createPageUrl("Pricing"))} className="ik-btn-pill text-sm">Manage plan</button>
        </section>
      ) : (
        <section className="ik-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: 'hsl(48 100% 97%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(43 59% 52%)' }}>
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Upgrade to unlock full platform access</h2>
              <p className="text-xs ik-text-muted mt-0.5">Get unlimited deal rooms, advanced analytics, and priority support.</p>
            </div>
          </div>
          <button onClick={() => navigate(createPageUrl("Pricing"))} className="ik-btn-gold text-sm flex items-center gap-2">
            View plans <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {/* NDA Banner */}
      {!hasNDA && (
        <section className="ik-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: 'hsl(30 100% 97%)', borderColor: 'hsl(30 80% 85%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(30 80% 90%)' }}>
              <Shield className="w-5 h-5" style={{ color: 'hsl(30 80% 45%)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'hsl(30 80% 25%)' }}>NDA Required</h2>
              <p className="text-xs mt-0.5" style={{ color: 'hsl(30 60% 40%)' }}>Accept our NDA to access agent profiles and deal rooms.</p>
            </div>
          </div>
          <Link to={createPageUrl("NDA")}>
            <button className="ik-btn-gold text-sm flex items-center gap-2">
              Sign NDA <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </section>
      )}

      {/* Main Content Grid */}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Suggested Agents */}
          <section className="ik-card p-5 sm:p-6">
            <header className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Suggested agents</h2>
                  <span className="ik-badge-gold text-xs">AI Powered</span>
                </div>
                <p className="text-xs ik-text-muted mt-0.5">AI-powered matches based on your investment goals.</p>
              </div>
              <button onClick={() => navigate(createPageUrl("AgentDirectory"))} className="text-xs font-medium hover:underline" style={{ color: 'hsl(43 71% 42%)' }}>View all</button>
            </header>

            {loadingSuggestedAgents ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="w-7 h-7 animate-spin mb-2" style={{ color: 'hsl(43 59% 52%)' }} />
                <p className="text-xs ik-text-muted">AI is analyzing your profile...</p>
              </div>
            ) : suggestedAgents.length === 0 ? (
              <p className="text-xs ik-text-muted py-4">No AI matches yet. Complete your profile for better matching.</p>
            ) : (
              <ul className="space-y-0 divide-y" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                {suggestedAgents.slice(0, 4).map(({ profile: agent, score }) => (
                  <li key={agent.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: 'hsl(0 0% 10%)' }}>{agent.full_name || 'Agent'}</p>
                        {score && score >= 0.8 && <span className="ik-badge-gold text-xs flex-shrink-0">Top</span>}
                      </div>
                      <p className="text-xs ik-text-muted mt-0.5 truncate">
                        {agent.agent?.markets?.[0] || agent.target_state || 'Market not set'}
                        {score && ` • ${(score * 100).toFixed(0)}% match`}
                      </p>
                    </div>
                    <button onClick={() => navigate(`${createPageUrl("AgentDirectory")}?highlight=${agent.id}`)} className="ik-btn-pill text-xs flex-shrink-0">View</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Documents */}
          <section className="ik-card p-5 sm:p-6">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Documents</h2>
              {docs.length > 0 && (
                <Link to={createPageUrl("InvestorDocuments")}>
                  <button className="text-xs font-medium hover:underline" style={{ color: 'hsl(43 71% 42%)' }}>Manage</button>
                </Link>
              )}
            </header>

            {docs.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {docs.slice(0, 3).map((doc, idx) => (
                  <li key={idx} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'hsl(0 0% 98%)' }}>
                    <FileText className="w-4 h-4 ik-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'hsl(0 0% 10%)' }}>{doc.name}</p>
                      <p className="ik-text-muted capitalize">{doc.type}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 text-xs">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(0 0% 95%)' }}>
                  <FileText className="w-4 h-4 ik-text-muted" />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'hsl(0 0% 28%)' }}>No documents uploaded yet</p>
                  <Link to={createPageUrl("InvestorDocuments")}>
                    <button className="font-medium hover:underline" style={{ color: 'hsl(43 71% 42%)' }}>Upload documents</button>
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Buy Box */}
          <section className="ik-card p-5 sm:p-6">
            <header className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Buy box</h2>
                <p className="text-xs ik-text-muted mt-0.5">Snapshot of what you're looking to buy.</p>
              </div>
              <Link to={createPageUrl("InvestorBuyBox")}>
                <button className="text-xs font-medium hover:underline" style={{ color: 'hsl(43 71% 42%)' }}>Edit</button>
              </Link>
            </header>

            {buyBox.asset_types || buyBox.markets || buyBox.min_budget ? (
              <dl className="space-y-3 text-xs">
                {buyBox.asset_types?.length > 0 && (
                  <div>
                    <dt className="ik-text-muted mb-1.5">Asset types</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {buyBox.asset_types.map((type, idx) => <span key={idx} className="ik-btn-pill text-xs px-2.5 py-1">{type}</span>)}
                    </dd>
                  </div>
                )}
                {buyBox.markets?.length > 0 && (
                  <div>
                    <dt className="ik-text-muted mb-1.5">Target markets</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {buyBox.markets.map((market, idx) => <span key={idx} className="ik-btn-pill text-xs px-2.5 py-1">{market}</span>)}
                    </dd>
                  </div>
                )}
                {(buyBox.min_budget || buyBox.max_budget) && (
                  <div>
                    <dt className="ik-text-muted mb-1">Budget range</dt>
                    <dd className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>${buyBox.min_budget?.toLocaleString() || '0'} - ${buyBox.max_budget?.toLocaleString() || '∞'}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="flex items-center gap-3 text-xs">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(0 0% 95%)' }}>
                  <Target className="w-4 h-4 ik-text-muted" />
                </div>
                <div>
                  <p className="font-medium" style={{ color: 'hsl(0 0% 28%)' }}>No buy box configured</p>
                  <Link to={createPageUrl("InvestorBuyBox")}>
                    <button className="font-medium hover:underline" style={{ color: 'hsl(43 71% 42%)' }}>Set up buy box</button>
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* Quick Links */}
          <section className="ik-card p-5 sm:p-6">
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'hsl(0 0% 10%)' }}>Quick links</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <Link to={createPageUrl("Pricing")} className="flex items-center justify-between w-full py-2 hover:text-amber-700 transition-colors" style={{ color: 'hsl(0 0% 28%)' }}>
                  <span>Subscription & plans</span>
                  <ArrowRight className="w-4 h-4 ik-text-muted" />
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("MyProfile")} className="flex items-center justify-between w-full py-2 hover:text-amber-700 transition-colors" style={{ color: 'hsl(0 0% 28%)' }}>
                  <span>My profile</span>
                  <ArrowRight className="w-4 h-4 ik-text-muted" />
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("DealRooms")} className="flex items-center justify-between w-full py-2 hover:text-amber-700 transition-colors" style={{ color: 'hsl(0 0% 28%)' }}>
                  <span>Deal rooms</span>
                  <ArrowRight className="w-4 h-4 ik-text-muted" />
                </Link>
              </li>
              <li>
                <Link to={createPageUrl("Billing")} className="flex items-center justify-between w-full py-2 hover:text-amber-700 transition-colors" style={{ color: 'hsl(0 0% 28%)' }}>
                  <span>Billing & payment</span>
                  <ArrowRight className="w-4 h-4 ik-text-muted" />
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}