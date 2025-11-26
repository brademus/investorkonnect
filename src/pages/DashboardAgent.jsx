import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Star, FileText, TrendingUp, Search, MessageCircle,
  Shield, CheckCircle, Award, MapPin, DollarSign, Home as HomeIcon
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
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const isVerified = profile?.vetted || profile?.agent?.verification_status === 'verified';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm px-6 md:px-20 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <HomeIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-700">INVESTOR KONNECT</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("InvestorDirectory")}>
              <Button variant="ghost" className="rounded-full font-medium">
                Browse Investors
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Agent Dashboard
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
              Agent
            </span>
            {isVerified && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </span>
            )}
          </div>
          <p className="text-gray-600">
            Welcome back, {profile?.full_name || 'Agent'}! Manage your profile and connect with investors.
          </p>
        </div>

        {/* Verification Status Banner */}
        {!isVerified && (
          <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50 border-2 border-amber-200 rounded-3xl p-6 mb-8">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-6 h-6 text-amber-600" />
                  <h3 className="text-xl font-bold text-gray-800">Get Verified</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Complete your verification to unlock full access and connect with serious investors. Free for all agents!
                </p>
                <Link to={createPageUrl("Vetting")}>
                  <Button className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                    Start Verification
                  </Button>
                </Link>
              </div>
              <Shield className="w-20 h-20 text-amber-200" />
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
                <p className="text-sm text-gray-600">View your inbox and requests</p>
              </div>
            </Link>

            <Link to={createPageUrl("Pricing")}>
              <div className="listing-card p-6 group">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-amber-500 transition-colors">
                  <Star className="w-7 h-7 text-amber-600 group-hover:text-white transition-colors" />
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
                <p className="text-sm text-gray-600">View and edit your profile</p>
              </div>
            </Link>

            <Link to={createPageUrl("DealRooms")}>
              <div className="listing-card p-6 group">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
                  <FileText className="w-7 h-7 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Deal Rooms</h3>
                <p className="text-sm text-gray-600">Active deals</p>
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
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Profile Views</h3>
              <Search className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Investor Leads</h3>
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-500 mt-1">Matched investors</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Active Deals</h3>
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-500 mt-1">Deals in progress</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500">Reviews</h3>
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-gray-800">0</p>
            <p className="text-xs text-gray-500 mt-1">5.0 average</p>
          </div>
        </div>

        {/* Profile Summary */}
        {profile && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Your Profile</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Full Name</p>
                  <p className="font-semibold text-gray-800">{profile.full_name || 'Not set'}</p>
                </div>
                {profile.company && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Brokerage</p>
                    <p className="font-semibold text-gray-800">{profile.company}</p>
                  </div>
                )}
                {profile.markets && profile.markets.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Target Markets</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.markets.map((market, idx) => (
                        <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                          <MapPin className="w-3 h-3 mr-1" />
                          {market}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Verification Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isVerified ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </>
                    ) : (
                      'Pending Verification'
                    )}
                  </span>
                </div>
                {profile.phone && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Phone</p>
                    <p className="font-semibold text-gray-800">{profile.phone}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
              <Link to={createPageUrl("Profile")}>
                <Button variant="outline" className="rounded-xl">View Public Profile</Button>
              </Link>
              <Link to={createPageUrl("AccountProfile")}>
                <Button variant="outline" className="rounded-xl">Edit Profile</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Getting Started Guide */}
        <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50 rounded-2xl p-6 border-2 border-amber-200 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Getting Started as an Agent</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">Profile Complete</p>
                <p className="text-sm text-gray-600">Your agent profile is set up</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                isVerified ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
              }`}>
                {isVerified && <CheckCircle className="w-5 h-5 text-white" />}
              </div>
              <div>
                <p className="font-medium text-gray-800">Get Verified</p>
                <p className="text-sm text-gray-600">
                  {isVerified ? 'Your profile is verified!' : 'Complete verification to appear in search results'}
                </p>
                {!isVerified && (
                  <Link to={createPageUrl("Vetting")}>
                    <Button size="sm" className="mt-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm">
                      Start Verification
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 mt-0.5"></div>
              <div>
                <p className="font-medium text-gray-800">Browse Investors</p>
                <p className="text-sm text-gray-600">See investor profiles that match your markets</p>
                <Link to={createPageUrl("InvestorDirectory")}>
                  <Button variant="outline" size="sm" className="mt-2 rounded-xl">
                    Browse Investors
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Benefits */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Why Investor Konnect?</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Free Membership</h3>
              <p className="text-sm text-gray-600">No fees. Agents never pay to join or use the platform.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Qualified Investors</h3>
              <p className="text-sm text-gray-600">Connect with serious, pre-vetted investors only.</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Build Reputation</h3>
              <p className="text-sm text-gray-600">Earn verified reviews and grow your business.</p>
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