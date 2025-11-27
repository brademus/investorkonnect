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
            Welcome back, {user?.full_name || 'Investor'}! 👋
          </h1>
          <p className="ik-text-subtle text-sm sm:text-base">Your Investor Konnect dashboard</p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate(createPageUrl("Admin"))} className="ik-btn-gold gap-2">
            <Shield className="w-4 h-4" /> Admin Panel
          </Button>
        )}
      </header>

      {/* Subscription Banner */}
      {isPaidSubscriber ? (
        <div className="ik-card p-4" style={{ background: 'hsl(48 100% 95%)', borderColor: 'hsl(44 68% 75%)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(43 59% 52%)' }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'hsl(43 71% 25%)' }}>{getPlanName(subscriptionPlan)} Plan Active</p>
                <p className="text-sm" style={{ color: 'hsl(43 71% 33%)' }}>
                  {subscriptionStatus === 'trialing' ? 'Free trial active' : 'Full access to all features'}
                </p>
              </div>
            </div>
            <button onClick={() => navigate(createPageUrl("Pricing"))} className="ik-btn-pill text-sm">Manage Plan</button>
          </div>
        </div>
      ) : (
        <div className="ik-card p-6" style={{ background: 'linear-gradient(135deg, hsl(48 100% 95%) 0%, hsl(51 100% 98%) 100%)', borderColor: 'hsl(44 68% 75%)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'hsl(43 59% 52%)' }}>
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Upgrade to unlock full platform access</h3>
                <p className="text-sm ik-text-muted">Get unlimited deal rooms, advanced analytics, and priority support</p>
              </div>
            </div>
            <button onClick={() => navigate(createPageUrl("Pricing"))} className="ik-btn-gold flex items-center gap-2">
              View Plans <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* NDA Banner */}
      {!hasNDA && (
        <div className="ik-card p-6" style={{ background: 'hsl(30 100% 97%)', borderColor: 'hsl(30 80% 80%)' }}>
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'hsl(30 80% 45%)' }} />
            <div className="flex-1">
              <h3 className="font-semibold mb-2" style={{ color: 'hsl(30 80% 25%)' }}>NDA Required</h3>
              <p className="text-sm mb-4" style={{ color: 'hsl(30 60% 35%)' }}>
                Accept our Non-Disclosure Agreement to access agent profiles and deal rooms.
              </p>
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
        {/* Suggested Agents */}
        <div className="ik-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Suggested Agents</h3>
                <span className="ik-badge-gold text-xs">AI Powered</span>
              </div>
              <p className="text-xs ik-text-muted mt-1">Smart matches based on your investment goals</p>
            </div>
            <button onClick={() => navigate(createPageUrl("AgentDirectory"))} className="text-xs font-medium" style={{ color: 'hsl(43 71% 42%)' }}>View All</button>
          </div>

          {loadingSuggestedAgents ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: 'hsl(270 60% 55%)' }} />
              <div className="text-xs ik-text-muted font-medium">AI is analyzing your profile...</div>
            </div>
          ) : suggestedAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="w-12 h-12 mb-3" style={{ color: 'hsl(0 0% 87%)' }} />
              <p className="text-xs ik-text-muted mb-3 text-center">No AI matches yet. Complete your profile for better matching.</p>
              <button onClick={() => navigate(createPageUrl("AgentDirectory"))} className="ik-btn-gold text-xs px-4 py-2">Browse all agents</button>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestedAgents.map(({ profile: agent, score }) => (
                <div key={agent.id} className="flex items-center justify-between border rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>{agent.full_name || 'Investor-friendly agent'}</span>
                      {score && score >= 0.8 && <span className="ik-badge-gold text-xs">Top Match</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs ik-text-muted mt-1">
                      <span>{agent.agent?.markets?.[0] || agent.target_state || 'Market not set'}</span>
                      {score && <Badge variant="outline" className="text-xs">{(score * 100).toFixed(0)}% match</Badge>}
                    </div>
                  </div>
                  <button onClick={() => navigate(`${createPageUrl("AgentDirectory")}?highlight=${agent.id}`)} className="text-xs font-medium" style={{ color: 'hsl(43 71% 42%)' }}>View profile</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buy Box */}
        <div className="ik-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" style={{ color: 'hsl(43 71% 42%)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Buy Box</h2>
            </div>
            <Link to={createPageUrl("InvestorBuyBox")}><button className="ik-btn-pill text-xs">Edit</button></Link>
          </div>

          {buyBox.asset_types || buyBox.markets || buyBox.min_budget ? (
            <div className="space-y-4">
              {buyBox.asset_types?.length > 0 && (
                <div>
                  <p className="text-xs ik-text-muted mb-2">Asset Types</p>
                  <div className="flex flex-wrap gap-2">
                    {buyBox.asset_types.map((type, idx) => <Badge key={idx} variant="secondary">{type}</Badge>)}
                  </div>
                </div>
              )}
              {buyBox.markets?.length > 0 && (
                <div>
                  <p className="text-xs ik-text-muted mb-2">Target Markets</p>
                  <div className="flex flex-wrap gap-2">
                    {buyBox.markets.map((market, idx) => <Badge key={idx} variant="secondary">{market}</Badge>)}
                  </div>
                </div>
              )}
              {(buyBox.min_budget || buyBox.max_budget) && (
                <div>
                  <p className="text-xs ik-text-muted mb-2">Budget Range</p>
                  <p className="font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>${buyBox.min_budget?.toLocaleString() || '0'} - ${buyBox.max_budget?.toLocaleString() || '∞'}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 mx-auto mb-3" style={{ color: 'hsl(0 0% 87%)' }} />
              <p className="text-sm ik-text-muted mb-3">No buy box configured yet</p>
              <Link to={createPageUrl("InvestorBuyBox")}><button className="ik-btn-gold text-xs px-4 py-2">Set Up Buy Box</button></Link>
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
            <Link to={createPageUrl("InvestorDocuments")}><button className="ik-btn-pill text-xs">Manage</button></Link>
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
              <p className="text-sm ik-text-muted mb-3">No documents uploaded yet</p>
              <Link to={createPageUrl("InvestorDocuments")}><button className="ik-btn-gold text-xs px-4 py-2">Upload Documents</button></Link>
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
            <Link to={createPageUrl("MyProfile")} className="ik-card ik-card-hover flex items-center gap-3 p-3">
              <User className="w-4 h-4 ik-text-muted" /> <span className="text-sm font-medium">My Profile</span>
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
    </div>
  );
}