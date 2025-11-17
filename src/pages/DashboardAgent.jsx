import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Star, FileText, TrendingUp, Search,
  Shield, CheckCircle, Mail, Award, MapPin, DollarSign
} from "lucide-react";

function AgentDashboardContent() {
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
      console.error('[AgentDashboard] Load error:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isVerified = profile?.vetted || profile?.agent?.verification_status === 'verified';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-bold text-slate-900">
              Agent Dashboard
            </h1>
            <Badge className="bg-emerald-100 text-emerald-800">
              Agent
            </Badge>
            {isVerified && (
              <Badge className="bg-blue-100 text-blue-800">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
          <p className="text-slate-600">
            Welcome back, {profile?.full_name || 'Agent'}! Manage your profile and connect with investors.
          </p>
        </div>

        {/* Verification Status Banner */}
        {!isVerified && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-6 h-6" />
                  <h3 className="text-xl font-bold">Get Verified</h3>
                </div>
                <p className="text-orange-50 mb-4">
                  Complete your verification to unlock full access and connect with serious investors. Free for all agents!
                </p>
                <Link to={createPageUrl("Vetting")}>
                  <Button className="bg-white text-orange-600 hover:bg-orange-50">
                    Start Verification
                  </Button>
                </Link>
              </div>
              <Shield className="w-20 h-20 text-white/20" />
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
              <p className="text-sm text-slate-600">View and edit your profile</p>
            </div>
          </Link>

          <Link to={createPageUrl("DealRooms")}>
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
                <FileText className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Deal Rooms</h3>
              <p className="text-sm text-slate-600">Active deals and collaborations</p>
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
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Profile Views</h3>
              <Search className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-500 mt-1">Last 30 days</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Investor Leads</h3>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-500 mt-1">Matched investors</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Active Deals</h3>
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-500 mt-1">Deals in progress</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-600">Reviews</h3>
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-slate-900">0</p>
            <p className="text-xs text-slate-500 mt-1">5.0 average</p>
          </div>
        </div>

        {/* Profile Summary */}
        {profile && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Your Profile</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Full Name</p>
                  <p className="font-semibold text-slate-900">{profile.full_name || 'Not set'}</p>
                </div>
                {profile.company && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Brokerage</p>
                    <p className="font-semibold text-slate-900">{profile.company}</p>
                  </div>
                )}
                {profile.markets && profile.markets.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Target Markets</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.markets.map((market, idx) => (
                        <Badge key={idx} variant="secondary">
                          <MapPin className="w-3 h-3 mr-1" />
                          {market}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Verification Status</p>
                  <Badge className={isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}>
                    {isVerified ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </>
                    ) : (
                      'Pending Verification'
                    )}
                  </Badge>
                </div>
                {profile.phone && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Phone</p>
                    <p className="font-semibold text-slate-900">{profile.phone}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-200 flex gap-3">
              <Link to={createPageUrl("Profile")}>
                <Button variant="outline">View Public Profile</Button>
              </Link>
              <Link to={createPageUrl("AccountProfile")}>
                <Button variant="outline">Edit Profile</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl p-6 border-2 border-emerald-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Getting Started as an Agent</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Profile Complete</p>
                <p className="text-sm text-slate-600">Your agent profile is set up</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                isVerified ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
              }`}>
                {isVerified && <CheckCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                <p className="font-medium text-slate-900">Get Verified</p>
                <p className="text-sm text-slate-600">
                  {isVerified ? 'Your profile is verified!' : 'Complete verification to appear in search results'}
                </p>
                {!isVerified && (
                  <Link to={createPageUrl("Vetting")}>
                    <Button size="sm" className="mt-2 bg-emerald-600 hover:bg-emerald-700">
                      Start Verification
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5"></div>
              <div>
                <p className="font-medium text-slate-900">Browse Investors</p>
                <p className="text-sm text-slate-600">See investor profiles that match your markets</p>
                <Link to={createPageUrl("InvestorDirectory")}>
                  <Button variant="outline" size="sm" className="mt-2">
                    Browse Investors
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Benefits */}
        <div className="mt-8 bg-white rounded-xl p-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Why AgentVault?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Free Membership</h3>
              <p className="text-sm text-slate-600">No fees. Agents never pay to join or use AgentVault.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Qualified Investors</h3>
              <p className="text-sm text-slate-600">Connect with serious, pre-vetted investors only.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                <Star className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Build Reputation</h3>
              <p className="text-sm text-slate-600">Earn verified reviews and grow your business.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function DashboardAgent() {
  return (
    <AuthGuard requireAuth={true}>
      <AgentDashboardContent />
    </AuthGuard>
  );
}