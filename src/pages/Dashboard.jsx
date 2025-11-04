
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Star, TrendingUp, FileText, 
  AlertCircle, Users, CheckCircle, Loader2, RefreshCw, Crown
} from "lucide-react";

function DashboardContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    loadAndRoute();
  }, []);

  const loadAndRoute = async () => {
    try {
      console.log('[Dashboard] Loading session...');
      
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const state = await response.json();
        console.log('[Dashboard] Session state:', state);
        setSession(state);

        // ROLE-BASED ROUTING
        // Check both new 'user_role' and old 'user_type' fields for backward compatibility
        const userRole = state.profile?.user_role || state.profile?.user_type; 
        // Check both new 'completed' and old 'onboarding_completed_at' fields for backward compatibility
        const onboardingCompleted = !!(state.onboarding?.completed || state.profile?.onboarding_completed_at);

        console.log('[Dashboard] Role:', userRole, 'Onboarding:', onboardingCompleted);

        // Not onboarded - redirect to onboarding
        if (!onboardingCompleted) {
          console.log('[Dashboard] Redirecting to onboarding...');
          navigate(createPageUrl("Onboarding"));
          return;
        }

        // Route based on role
        if (userRole === 'investor') {
          console.log('[Dashboard] Redirecting to investor dashboard...');
          navigate(createPageUrl("DashboardInvestor"));
          return;
        }

        if (userRole === 'agent') {
          console.log('[Dashboard] Redirecting to agent dashboard...');
          navigate(createPageUrl("DashboardAgent"));
          return;
        }

        // No specific role or already onboarded, show generic dashboard (fallback)
        console.log('[Dashboard] No specific role or already onboarded, showing generic dashboard');
        setLoading(false);
      } else {
        console.error('[Dashboard] Failed to load session:', response.status);
        setLoading(false);
      }
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
  const hasCompletedOnboarding = !!(session?.onboarding?.completed || session?.profile?.onboarding_completed_at);
  const isAdmin = user.role === 'admin';
  const subscription = session?.subscription || {};

  // Generic dashboard fallback (if no role specific dashboard was routed)
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back{user.full_name ? `, ${user.full_name}` : ''}!
          </h1>
          <p className="text-slate-600">Complete your profile to get started</p>
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

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {/* Account Type */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1 capitalize">
              {user.user_type || "Member"}
            </h3>
            <p className="text-slate-600 text-sm">Account Type</p>
            {isAdmin && (
              <Badge className="mt-2 bg-orange-50 text-orange-700 border-orange-200">
                <Crown className="w-3 h-3 mr-1" />
                Admin Access
              </Badge>
            )}
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Star className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1 capitalize">
              {subscription.tier && subscription.tier !== 'none' ? subscription.tier : 'None'}
            </h3>
            <p className="text-slate-600 text-sm">Subscription Plan</p>
          </div>

          {/* Active Deals */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">0</h3>
            <p className="text-slate-600 text-sm">Active Deals</p>
          </div>

          {/* Connections */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-1">0</h3>
            <p className="text-slate-600 text-sm">Connections</p>
          </div>
        </div>

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
