
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Shield, FileText, Users, CheckCircle,
  AlertCircle, Building, Target, DollarSign, ArrowRight, Star,
  Loader2, RefreshCw, MapPin, Award, User
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

  // AI-powered suggested agents
  const [suggestedAgents, setSuggestedAgents] = useState([]);
  const [loadingSuggestedAgents, setLoadingSuggestedAgents] = useState(true);

  // Check if user is admin
  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin' || user?.role === 'admin';

  // Load AI-matched agents when profile is ready
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

      console.log('[InvestorHome] 🤖 Starting AI matching...');

      // Step 1: Ensure investor has an embedding
      const embedResponse = await base44.functions.invoke('embedProfile');
      console.log('[InvestorHome] Embedding response:', embedResponse.data);

      // Step 2: Get AI-matched agents
      const matchResponse = await base44.functions.invoke('matchAgentsForInvestor', {
        limit: 6
      });

      console.log('[InvestorHome] Match response:', matchResponse.data);

      if (!cancelled && matchResponse.data?.ok) {
        const results = matchResponse.data.results || [];
        setSuggestedAgents(results);
        console.log('[InvestorHome] ✅ Loaded', results.length, 'AI-matched agents');
      } else {
        console.warn('[InvestorHome] No AI matches returned');
        setSuggestedAgents([]);
      }
    } catch (err) {
      console.error("[InvestorHome] AI matching error:", err);
      toast.error("Failed to load agent matches");
      if (!cancelled) setSuggestedAgents([]);
    } finally {
      if (!cancelled) setLoadingSuggestedAgents(false);
    }

    return () => {
      cancelled = true;
    };
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  // Helper to get plan display name
  const getPlanName = (plan) => {
    const names = {
      'starter': 'Starter',
      'pro': 'Pro',
      'enterprise': 'Enterprise',
      'none': 'Free'
    };
    return names[plan] || 'Free';
  };

  const hasNDA = profile?.nda_accepted;
  const buyBox = profile?.investor?.buy_box || {};
  const docs = profile?.investor?.documents || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header with Admin Button */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back, {user?.full_name || 'Investor'}! 👋
            </h1>
            <p className="text-slate-600">
              Your AgentVault dashboard
            </p>
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

        {/* Subscription Status Banner */}
        {isPaidSubscriber ? (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900">
                    {getPlanName(subscriptionPlan)} Plan Active
                  </p>
                  <p className="text-sm text-emerald-700">
                    {subscriptionStatus === 'trialing' ? 'Free trial active' : 'Full access to all features'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(createPageUrl("Pricing"))}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              >
                Manage Plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">
                    Upgrade to unlock full platform access
                  </h3>
                  <p className="text-sm text-slate-600">
                    Get unlimited deal rooms, advanced analytics, and priority support
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate(createPageUrl("Pricing"))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Plans
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* NDA Required Banner */}
        {!hasNDA && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">NDA Required</h3>
                <p className="text-orange-800 mb-4">
                  You need to accept our Non-Disclosure Agreement to access agent profiles and deal rooms.
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
          {/* AI-Powered Suggested Agents */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-slate-800">Suggested Agents</h3>
                  <Badge className="bg-purple-100 text-purple-800 text-xs">
                    AI Powered
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Smart matches based on your investment goals and preferences
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-slate-700 hover:text-slate-900"
                onClick={() => navigate(createPageUrl("AgentDirectory"))}
              >
                View All
              </button>
            </div>

            {loadingSuggestedAgents ? (
              <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-500">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
                <div className="font-medium">AI is analyzing your profile...</div>
                <div className="mt-1">Finding the best agent matches for you</div>
              </div>
            ) : suggestedAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-500">
                <Users className="w-12 h-12 text-slate-300 mb-3" />
                <p className="mb-3 text-center">
                  No AI matches yet. Complete your profile for better matching.
                </p>
                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700"
                  onClick={() => navigate(createPageUrl("AgentDirectory"))}
                >
                  Browse all agents
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestedAgents.map(({ profile: agent, score }) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-900">
                          {agent.full_name || 'Investor-friendly agent'}
                        </div>
                        {score && score >= 0.8 && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                            Top Match
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>
                          {agent.agent?.markets?.[0] || agent.target_state || 'Market not set'}
                        </span>
                        {score && (
                          <Badge variant="outline" className="text-xs">
                            {(score * 100).toFixed(0)}% match
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      onClick={() => navigate(`${createPageUrl("AgentDirectory")}?highlight=${agent.id}`)}
                    >
                      View profile
                    </button>
                  </div>
                ))}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    className="inline-flex items-center text-xs text-slate-700 hover:text-slate-900"
                    onClick={() => navigate(createPageUrl("AgentDirectory"))}
                  >
                    <span className="mr-1">Find more matches</span>
                    <span className="text-slate-400">↗</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Buy Box Summary */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-900">Buy Box</h2>
              </div>
              <Link to={createPageUrl("InvestorBuyBox")}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </div>

            {buyBox.asset_types || buyBox.markets || buyBox.min_budget ? (
              <div className="space-y-4">
                {buyBox.asset_types && buyBox.asset_types.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Asset Types</p>
                    <div className="flex flex-wrap gap-2">
                      {buyBox.asset_types.map((type, idx) => (
                        <Badge key={idx} variant="secondary">{type}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {buyBox.markets && buyBox.markets.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Target Markets</p>
                    <div className="flex flex-wrap gap-2">
                      {buyBox.markets.map((market, idx) => (
                        <Badge key={idx} variant="secondary">{market}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(buyBox.min_budget || buyBox.max_budget) && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Budget Range</p>
                    <p className="font-semibold text-slate-900">
                      ${buyBox.min_budget?.toLocaleString() || '0'} - ${buyBox.max_budget?.toLocaleString() || '∞'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">No buy box configured yet</p>
                <Link to={createPageUrl("InvestorBuyBox")}>
                  <Button size="sm">Set Up Buy Box</Button>
                </Link>
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
              <Link to={createPageUrl("InvestorDocuments")}>
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
                <p className="text-slate-600 mb-3">No documents uploaded yet</p>
                <Link to={createPageUrl("InvestorDocuments")}>
                  <Button size="sm">Upload Documents</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Links</h2>
            <div className="space-y-2">
              <Link to={createPageUrl("Pricing")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Star className="w-4 h-4 text-blue-600" />
                  Subscription & Plans
                </Button>
              </Link>
              <Link to={createPageUrl("MyProfile")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <User className="w-4 h-4 text-slate-700" />
                  My Profile
                </Button>
              </Link>
              <Link to={createPageUrl("DealRooms")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Deal Rooms
                </Button>
              </Link>
              <Link to={createPageUrl("Billing")}>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Billing & Payment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
