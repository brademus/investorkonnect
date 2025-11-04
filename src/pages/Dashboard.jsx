
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState(null);
  const [ndaStatus, setNdaStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('[Dashboard] 🔄 Loading session data...');
      
      // Load session state
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
        console.log('[Dashboard] ✅ Session state loaded:', state);
        console.log('[Dashboard] Profile role:', state.profile?.role);
        console.log('[Dashboard] Profile user_type:', state.profile?.user_type);
        console.log('[Dashboard] Subscription:', state.subscription);
        setSession(state);
      } else {
        console.error('[Dashboard] ❌ Failed to load session:', response.status);
      }

      // Load NDA status
      try {
        const ndaResponse = await base44.functions.invoke('ndaStatus');
        console.log('[Dashboard] ✅ NDA status loaded:', ndaResponse.data);
        setNdaStatus(ndaResponse.data.nda);
      } catch (e) {
        console.error('[Dashboard] ❌ Failed to load NDA status:', e);
        setNdaStatus({ accepted: false, error: true });
      }

      setLoading(false);
    } catch (error) {
      console.error('[Dashboard] ❌ Load error:', error);
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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
  const isAdmin = user.role === 'admin';
  const subscription = session?.subscription || {};

  console.log('[Dashboard] Render state:', {
    hasProfile: !!user,
    fullName: user.full_name,
    role: user.role,
    userType: user.user_type,
    isAdmin: isAdmin,
    subscriptionTier: subscription.tier,
    subscriptionStatus: subscription.status,
    onboardingCompleted: hasCompletedOnboarding
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome back{user.full_name ? `, ${user.full_name}` : ''}!
              </h1>
              <p className="text-slate-600">Here's what's happening with your account</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              {/* Admin Badge */}
              {isAdmin && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                  <Crown className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
              )}
              
              {/* Onboarding Status */}
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
              
              {/* Subscription Badge */}
              {subscription.tier && subscription.tier !== 'none' && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 capitalize">
                  <Star className="w-3 h-3 mr-1" />
                  {subscription.tier} Plan
                </Badge>
              )}
              
              {/* NDA Badge */}
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
            {subscription.status && subscription.status !== 'none' && (
              <Badge className={`mt-2 ${
                subscription.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                subscription.status === 'trialing' ? 'bg-blue-50 text-blue-700' :
                'bg-slate-50 text-slate-700'
              }`}>
                {subscription.status}
              </Badge>
            )}
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

        {/* Profile Info */}
        {user && Object.keys(user).length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Your Profile</h2>
              <div className="flex gap-2">
                {hasCompletedOnboarding && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
                {isAdmin && (
                  <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                    <Crown className="w-3 h-3 mr-1" />
                    Administrator
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Email</p>
                  <p className="font-semibold text-slate-900">{session?.email || 'Not set'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-slate-600 mb-1">Full Name</p>
                  <p className="font-semibold text-slate-900">{user.full_name || 'Not set'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-slate-600 mb-1">Account Type</p>
                  <Badge variant="secondary" className="capitalize">
                    {user.user_type || 'Not set'}
                  </Badge>
                </div>
                
                <div>
                  <p className="text-sm text-slate-600 mb-1">Platform Role</p>
                  <Badge variant="secondary" className="capitalize">
                    {user.role || 'member'}
                    {isAdmin && ' 👑'}
                  </Badge>
                </div>
                
                {user.phone && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Phone</p>
                    <p className="font-semibold text-slate-900">{user.phone}</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                {user.company && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Company</p>
                    <p className="font-semibold text-slate-900">{user.company}</p>
                  </div>
                )}
                
                {subscription.tier && subscription.tier !== 'none' && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Subscription</p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800 capitalize">
                        {subscription.tier} Plan
                      </Badge>
                      <Badge className={
                        subscription.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                        subscription.status === 'trialing' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-800'
                      }>
                        {subscription.status}
                      </Badge>
                    </div>
                  </div>
                )}
                
                {user.markets && user.markets.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Target Markets</p>
                    <div className="flex flex-wrap gap-2">
                      {user.markets.map((market, idx) => (
                        <Badge key={idx} variant="secondary">{market}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {user.accreditation && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Accreditation</p>
                    <p className="font-semibold text-slate-900">{user.accreditation}</p>
                  </div>
                )}
                
                {user.goals && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Goals</p>
                    <p className="font-semibold text-slate-900 line-clamp-3">{user.goals}</p>
                  </div>
                )}
              </div>
            </div>
            
            {session?.onboarding?.completedAt && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">
                  Profile completed on {new Date(session.onboarding.completedAt).toLocaleDateString()}
                </p>
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-slate-200 flex gap-3">
              <Link to={createPageUrl("Profile")}>
                <Button variant="outline">View Full Profile</Button>
              </Link>
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
        {hasCompletedOnboarding && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mt-8">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 mb-2">You're all set!</h3>
                <p className="text-blue-800 mb-4">
                  Your profile is complete. Explore verified agents, view reviews, and manage your subscription from this dashboard.
                </p>
                <Link to={createPageUrl("HowItWorks")}>
                  <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                    Learn How It Works
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
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
