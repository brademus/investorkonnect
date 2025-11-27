import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  Search, MessageSquare, Users, FileText, TrendingUp,
  MapPin, DollarSign, CheckCircle2, ArrowRight, User, Shield
} from "lucide-react";

function InvestorDashboardContent() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileCompletion] = useState(85);

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
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Investor';
  const userData = {
    activeConnections: 3,
    pendingInvites: 2,
    unreadMessages: 2,
    activeDealRooms: 1
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <Shield className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold text-gray-900">INVESTOR KONNECT</span>
            </Link>

            <div className="flex-1 max-w-2xl mx-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search agents, locations..."
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link to={createPageUrl("Inbox")} className="relative p-2 hover:bg-gray-100 rounded-lg transition">
                <MessageSquare size={24} className="text-gray-600" />
                {userData.unreadMessages > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {userData.unreadMessages}
                  </span>
                )}
              </Link>
              <Link to={createPageUrl("MyProfile")} className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                <User size={18} className="text-white" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {firstName}!</h1>
          <p className="text-gray-600 mt-2">Your Investor Konnect dashboard</p>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Profile Strength */}
          <div className="metric-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Profile Strength</h3>
                <p className="text-sm text-gray-600 mt-1">Complete your profile for better matches</p>
              </div>
              <TrendingUp className="text-amber-500" size={24} />
            </div>
            <div className="mb-4">
              <div className="flex items-end gap-2 mb-2">
                <span className="metric-number">{profileCompletion}%</span>
                <span className="text-sm text-gray-600 mb-1">Complete</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${profileCompletion}%` }}></div>
              </div>
            </div>
            <Link to={createPageUrl("MyProfile")} className="inline-flex items-center gap-2 text-amber-600 font-semibold hover:text-amber-700 transition">
              Complete Profile <ArrowRight size={18} />
            </Link>
          </div>

          {/* Active Connections */}
          <div className="metric-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Active Connections</h3>
                <p className="text-sm text-gray-600 mt-1">Agents you're working with</p>
              </div>
              <Users className="text-blue-500" size={24} />
            </div>
            <div className="mb-4">
              <div className="metric-number">{userData.activeConnections}</div>
              <div className="text-sm text-gray-600 mt-2">{userData.pendingInvites} pending invites</div>
            </div>
            <Link to={createPageUrl("AgentDirectory")} className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-700 transition">
              View All Connections <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="section-title">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to={createPageUrl("AgentDirectory")} className="action-card block">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-amber-600" size={32} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Find Agents</h3>
              <p className="text-gray-600 mb-4">Browse 1,200+ verified agents</p>
              <button className="btn-primary-professional w-full">Browse Now</button>
            </Link>

            <Link to={createPageUrl("Inbox")} className="action-card block">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="text-blue-600" size={32} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Messages</h3>
              <p className="text-gray-600 mb-4">
                {userData.unreadMessages > 0 ? `${userData.unreadMessages} unread messages` : "No new messages"}
              </p>
              <button className="btn-secondary-professional w-full">Open Inbox</button>
            </Link>

            <Link to={createPageUrl("DealRooms")} className="action-card block">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-purple-600" size={32} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Deal Rooms</h3>
              <p className="text-gray-600 mb-4">
                {userData.activeDealRooms > 0 ? `${userData.activeDealRooms} active room` : "No active rooms"}
              </p>
              <button className="btn-secondary-professional w-full">View Rooms</button>
            </Link>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="card-professional">
            <h2 className="section-title">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">Sarah J. viewed your profile</p>
                  <p className="text-sm text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex-shrink-0 flex items-center justify-center">
                  <CheckCircle2 className="text-amber-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">New agent match available</p>
                  <p className="text-sm text-gray-500">Yesterday</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">Michael K. sent you a message</p>
                  <p className="text-sm text-gray-500">2 days ago</p>
                </div>
              </div>
            </div>
          </div>

          {/* Investment Preferences */}
          <div className="card-professional">
            <h2 className="section-title">Investment Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="text-gray-400 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Asset Type</p>
                  <p className="text-gray-900 font-medium">Single Family, Land</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="text-gray-400 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Budget Range</p>
                  <p className="text-gray-900 font-medium">$100,000 - $500,000</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="text-gray-400 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Target Markets</p>
                  <p className="text-gray-900 font-medium">{profile?.target_state || 'Not set'}</p>
                </div>
              </div>
            </div>
            <Link to={createPageUrl("MyProfile")} className="inline-flex items-center gap-2 text-amber-600 font-semibold hover:text-amber-700 transition mt-4">
              Edit Preferences <ArrowRight size={18} />
            </Link>
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