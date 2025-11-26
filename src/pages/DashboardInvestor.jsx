import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Star, Users, FileText, Search, MessageCircle,
  Shield, Zap, ArrowRight, CheckCircle, DollarSign, Home as HomeIcon
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
      <div className="min-h-screen bg-[hsl(0_0%_98%)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[hsl(43_59%_52%)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const hasActiveSubscription = profile?.subscription_tier && profile?.subscription_tier !== 'none';

  return (
    <div className="min-h-screen bg-[hsl(0_0%_98%)]">
      {/* Navigation Bar */}
      <nav className="navbar px-6 md:px-20 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-500 rounded-xl flex items-center justify-center">
              <HomeIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-700">INVESTOR KONNECT</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("AgentDirectory")}>
              <Button variant="ghost" className="rounded-full font-medium">
                Browse Agents
              </Button>
            </Link>
            <Link to={createPageUrl("MyProfile")}>
              <Button variant="outline" className="rounded-full border-gray-300">
                Profile
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container-airbnb py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-gold-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Investor Dashboard
            </h1>
            <span className="badge-gold">Investor</span>
          </div>
          <p className="text-gray-600">
            Welcome back, {profile?.full_name || 'Investor'}! Find verified agents and manage your deal flow.
          </p>
        </div>

        {/* Subscription Status Banner */}
        {!hasActiveSubscription && (
          <div className="bg-gold-gradient border-2 border-gold-200 rounded-3xl p-6 mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-6 h-6 text-gold-600" />
                  <h3 className="text-xl font-bold text-gray-800">Unlock Full Access</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Subscribe to browse agents, view reviews, create deal rooms, and more. Start with a 14-day free trial.
                </p>
                <Link to={createPageUrl("Pricing")}>
                  <Button className="btn-gold">
                    View Plans
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <Zap className="w-20 h-20 text-gold-200" />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* Messages Button - FIRST POSITION */}
            <Link to={createPageUrl("Inbox")}>
              <div className="listing-card p-6 group">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                  <MessageCircle className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Messages</h3>
                <p className="text-sm text-gray-600">View your inbox and conversations</p>
              </div>
            </Link>

            <Link to={createPageUrl("Pricing")}>
              <div className="listing-card p-6 group">
                <div className="w-14 h-14 bg-gold-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-gold-500 transition-colors">
                  <Star className="w-7 h-7 text-gold-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Subscription</h3>
                <p className="text-sm text-gray-600">Manage your subscription</p>
              </div>
            </Link>

            <Link to={createPageUrl("MyProfile")}>
              <div className="listing-card p-6 group">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors">
                  <Users className="w-7 h-7 text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">My Profile</h3>
                <p className="text-sm text-gray-600">Update your preferences</p>
              </div>
            </Link>

            <Link to={createPageUrl("DealRooms")}>
              <div className="listing-card p-6 group">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
                  <FileText className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Deal Rooms</h3>
                <p className="text-sm text-gray-600">Manage active deals</p>
              </div>
            </Link>

            <Link to={createPageUrl("Billing")}>
              <div className="listing-card p-6 group">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-amber-500 transition-colors">
                  <DollarSign className="w-7 h-7 text-amber-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Billing</h3>
                <p className="text-sm text-gray-600">Payment methods</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Saved Agents</h3>
              <Star className="w-5 h-5 text-gold-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-500 mt-1">Agents you're interested in</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Active Deals</h3>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-500 mt-1">Deals in progress</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Connections</h3>
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-500 mt-1">Connected agents</p>
          </div>
        </div>

        {/* Buy Box Summary */}
        {profile?.markets && profile.markets.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Your Investment Criteria</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Target Markets</p>
                <div className="flex flex-wrap gap-2">
                  {profile.markets.map((market, idx) => (
                    <span key={idx} className="badge-gold">{market}</span>
                  ))}
                </div>
              </div>
              {profile.goals && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Investment Goals</p>
                  <p className="text-sm text-gray-800">{profile.goals}</p>
                </div>
              )}
            </div>
            <Link to={createPageUrl("AccountProfile")}>
              <Button variant="outline" size="sm" className="mt-4 rounded-xl">
                Update Criteria
              </Button>
            </Link>
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="bg-gold-gradient rounded-2xl p-6 border-2 border-gold-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Getting Started</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Profile Complete</p>
                <p className="text-sm text-gray-600">Your investor profile is set up</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                hasActiveSubscription ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
              }`}>
                {hasActiveSubscription && <CheckCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                <p className="font-medium text-gray-800">Choose a Plan</p>
                <p className="text-sm text-gray-600">
                  {hasActiveSubscription ? 'You have an active subscription' : 'Subscribe to unlock full access'}
                </p>
                {!hasActiveSubscription && (
                  <Link to={createPageUrl("Pricing")}>
                    <Button size="sm" className="mt-2 btn-gold">
                      View Plans
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5"></div>
              <div>
                <p className="font-medium text-gray-800">Browse Agents</p>
                <p className="text-sm text-gray-600">Start exploring verified agent profiles</p>
                <Link to={createPageUrl("AgentDirectory")}>
                  <Button variant="outline" size="sm" className="mt-2 rounded-xl">
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