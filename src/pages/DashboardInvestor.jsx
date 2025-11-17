import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Star, Users, FileText, Search, 
  Shield, Zap, Plus, ArrowRight, CheckCircle, DollarSign
} from "lucide-react";

function InvestorDashboardContent() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.ok) {
        const state = await response.json();
        setProfile(state.profile);
      }
      setLoading(false);
    } catch (error) {
      console.error('[InvestorDashboard] Load error:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const hasActiveSubscription = profile?.subscription_tier && profile?.subscription_tier !== 'none';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">
              Investor Dashboard
            </h1>
            <Badge className="bg-blue-100 text-blue-800">
              Investor
            </Badge>
          </div>
          <p className="text-slate-600">
            Welcome back, {profile?.full_name || 'Investor'}! Find verified agents and manage your deal flow.
          </p>
        </div>

        {/* Subscription Status Banner */}
        {!hasActiveSubscription && (
          <div className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-6 h-6" />
                  <h3 className="text-xl font-bold">Unlock Full Access</h3>
                </div>
                <p className="text-blue-50 mb-4">
                  Subscribe to browse agents, view reviews, create deal rooms, and more. Start with a 14-day free trial.
                </p>
                <Link to={createPageUrl("Pricing")}>
                  <Button className="bg-white text-blue-600 hover:bg-blue-50">
                    View Plans
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <Zap className="w-20 h-20 text-white/20" />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to={createPageUrl("Pricing")}>
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                <Star className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Subscription & Plans</h3>
              <p className="text-sm text-slate-600">Manage your subscription</p>
            </div>
          </Link>

          <Link to={createPageUrl("MyProfile")}>
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors">
                <Users className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">My Profile</h3>
              <p className="text-sm text-slate-600">Update your profile and preferences</p>
            </div>
          </Link>

          <Link to={createPageUrl("DealRooms")}>
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
                <FileText className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Deal Rooms</h3>
              <p className="text-sm text-slate-600">Manage active deals and documents</p>
            </div>
          </Link>

          <Link to={createPageUrl("Billing")}>
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-amber-400 hover:shadow-lg transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-600 transition-colors">
                <DollarSign className="w-6 h-6 text-amber-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Billing & Payment</h3>
              <p className="text-sm text-slate-600">Manage billing and payment methods</p>
            </div>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Saved Agents</h3>
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-500 mt-1">Agents you're interested in</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Active Deals</h3>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-500 mt-1">Deals in progress</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Connections</h3>
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-500 mt-1">Connected agents</p>
          </div>
        </div>

        {/* Buy Box Summary */}
        {profile?.markets && profile.markets.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Your Investment Criteria</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Target Markets</p>
                <div className="flex flex-wrap gap-2">
                  {profile.markets.map((market, idx) => (
                    <Badge key={idx} variant="secondary">{market}</Badge>
                  ))}
                </div>
              </div>
              {profile.goals && (
                <div>
                  <p className="text-sm text-slate-600 mb-2">Investment Goals</p>
                  <p className="text-sm text-slate-900">{profile.goals}</p>
                </div>
              )}
            </div>
            <Link to={createPageUrl("AccountProfile")}>
              <Button variant="outline" size="sm" className="mt-4">
                Update Criteria
              </Button>
            </Link>
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-xl p-6 border-2 border-blue-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Getting Started</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Profile Complete</p>
                <p className="text-sm text-slate-600">Your investor profile is set up</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                hasActiveSubscription ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
              }`}>
                {hasActiveSubscription && <CheckCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                <p className="font-medium text-slate-900">Choose a Plan</p>
                <p className="text-sm text-slate-600">
                  {hasActiveSubscription ? 'You have an active subscription' : 'Subscribe to unlock full access'}
                </p>
                {!hasActiveSubscription && (
                  <Link to={createPageUrl("Pricing")}>
                    <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700">
                      View Plans
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5"></div>
              <div>
                <p className="font-medium text-slate-900">Browse Agents</p>
                <p className="text-sm text-slate-600">Start exploring verified agent profiles</p>
                <Link to={createPageUrl("AgentDirectory")}>
                  <Button variant="outline" size="sm" className="mt-2">
                    Browse Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function DashboardInvestor() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorDashboardContent />
    </AuthGuard>
  );
}