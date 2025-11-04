import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Star, TrendingUp, FileText, 
  AlertCircle, Users, CheckCircle, Loader2
} from "lucide-react";

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [ndaStatus, setNdaStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load session state
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (response.ok) {
        const state = await response.json();
        console.log('[Dashboard] Session state:', state);
        setSession(state);
      }

      // Load NDA status
      try {
        const ndaResponse = await base44.functions.invoke('ndaStatus');
        setNdaStatus(ndaResponse.data.nda);
      } catch (e) {
        console.error('Failed to load NDA status:', e);
        setNdaStatus({ accepted: false, error: true });
      }

      setLoading(false);
    } catch (error) {
      console.error('[Dashboard] Load error:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const user = session?.profile || {};
  const hasCompletedOnboarding = session?.onboarding?.completed || false;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome back, {user.full_name || session?.email?.split('@')[0] || 'there'}!
              </h1>
              <p className="text-slate-600">Here's what's happening with your account</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {hasCompletedOnboarding ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Profile Complete
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Profile Incomplete
                </Badge>
              )}
              {ndaStatus && (
                ndaStatus.accepted ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <Shield className="w-3 h-3 mr-1" />
                    NDA Signed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    NDA Required
                  </Badge>
                )
              )}
            </div>
          </div>
        </div>

        {/* Onboarding Reminder */}
        {!hasCompletedOnboarding && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2">Complete Your Profile</h3>
                <p className="text-blue-800 mb-4">
                  Take a few minutes to complete your profile and get the most out of AgentVault.
                </p>
                <Link to={createPageUrl("Onboarding")}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Complete Profile Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* NDA Reminder */}
        {hasCompletedOnboarding && ndaStatus && !ndaStatus.accepted && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 mb-2">NDA Signature Required</h3>
                <p className="text-orange-800 mb-4">
                  Sign our Non-Disclosure Agreement to access agent profiles and deal rooms.
                </p>
                <Link to={createPageUrl("NDA")}>
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    Sign NDA Now
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1 capitalize">
              {user.user_type || "Member"}
            </h3>
            <p className="text-slate-600 text-sm">Account Type</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">0</h3>
            <p className="text-slate-600 text-sm">Active Deals</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">0</h3>
            <p className="text-slate-600 text-sm">Connections</p>
          </div>
        </div>

        {/* Profile Info */}
        {user && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Your Profile</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-600">Email</p>
                <p className="font-semibold text-slate-900">{session?.email || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Full Name</p>
                <p className="font-semibold text-slate-900">{user.full_name || 'Not set'}</p>
              </div>
              {user.markets && user.markets.length > 0 && (
                <div>
                  <p className="text-sm text-slate-600">Markets</p>
                  <p className="font-semibold text-slate-900">{user.markets.join(", ")}</p>
                </div>
              )}
              {user.phone && (
                <div>
                  <p className="text-sm text-slate-600">Phone</p>
                  <p className="font-semibold text-slate-900">{user.phone}</p>
                </div>
              )}
              {user.company && (
                <div>
                  <p className="text-sm text-slate-600">Company</p>
                  <p className="font-semibold text-slate-900">{user.company}</p>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex gap-3">
              <Link to={createPageUrl("AccountProfile")}>
                <Button variant="outline">Edit Profile</Button>
              </Link>
              {!hasCompletedOnboarding && (
                <Link to={createPageUrl("Onboarding")}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Complete Onboarding
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Quick Actions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to={createPageUrl("Reviews")}>
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <Star className="w-5 h-5 text-yellow-600" />
                <div className="text-left">
                  <div className="font-semibold">Browse Agents</div>
                  <div className="text-xs text-slate-600">View verified profiles</div>
                </div>
              </Button>
            </Link>
            <Link to={createPageUrl("Pricing")}>
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <Shield className="w-5 h-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-semibold">Subscription</div>
                  <div className="text-xs text-slate-600">Manage plan</div>
                </div>
              </Button>
            </Link>
            <Link to={createPageUrl("AccountBilling")}>
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <div className="text-left">
                  <div className="font-semibold">Billing</div>
                  <div className="text-xs text-slate-600">Settings & billing</div>
                </div>
              </Button>
            </Link>
            <Link to={createPageUrl("Contact")}>
              <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4">
                <Users className="w-5 h-5 text-purple-600" />
                <div className="text-left">
                  <div className="font-semibold">Support</div>
                  <div className="text-xs text-slate-600">Get help</div>
                </div>
              </Button>
            </Link>
          </div>
        </div>

        {/* Welcome Info Box */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mt-8">
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 mb-2">Welcome to AgentVault!</h3>
              <p className="text-blue-800 mb-4">
                Your account is active. Explore verified agents, view reviews, and manage your subscription from this dashboard.
              </p>
              <Link to={createPageUrl("HowItWorks")}>
                <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  Learn How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthGuard requireAuth={true}>
      <DashboardContent />
    </AuthGuard>
  );
}