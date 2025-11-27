import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  Search, MessageSquare, Users, FileText, TrendingUp,
  MapPin, DollarSign, ArrowRight
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent mx-auto" style={{ borderColor: 'hsl(43 59% 52%)', borderTopColor: 'transparent' }}></div>
          <p className="mt-4 ik-text-muted text-sm">Loading your dashboard...</p>
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
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold" style={{ color: 'hsl(0 0% 0%)' }}>
            Welcome back, {firstName}!
          </h1>
          <p className="ik-text-subtle text-sm sm:text-base">
            Your Investor Konnect dashboard
          </p>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="ik-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Profile Strength</h3>
              <p className="text-sm ik-text-muted mt-1">Complete your profile for better matches</p>
            </div>
            <TrendingUp className="w-5 h-5" style={{ color: 'hsl(43 59% 52%)' }} />
          </div>
          <div className="mb-4">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold" style={{ color: 'hsl(0 0% 10%)' }}>{profileCompletion}%</span>
              <span className="text-sm ik-text-muted mb-1">Complete</span>
            </div>
            <div className="ik-progress-bar">
              <div className="ik-progress-fill" style={{ width: `${profileCompletion}%` }}></div>
            </div>
          </div>
          <Link to={createPageUrl("MyProfile")} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'hsl(43 71% 42%)' }}>
            Complete Profile <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="ik-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Active Connections</h3>
              <p className="text-sm ik-text-muted mt-1">Agents you're working with</p>
            </div>
            <Users className="w-5 h-5" style={{ color: 'hsl(217 91% 60%)' }} />
          </div>
          <div className="mb-4">
            <div className="text-3xl font-bold" style={{ color: 'hsl(0 0% 10%)' }}>{userData.activeConnections}</div>
            <div className="text-sm ik-text-muted mt-2">{userData.pendingInvites} pending invites</div>
          </div>
          <Link to={createPageUrl("AgentDirectory")} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'hsl(217 91% 60%)' }}>
            View All Connections <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'hsl(0 0% 10%)' }}>Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to={createPageUrl("AgentDirectory")} className="ik-card ik-card-hover p-6 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(48 100% 95%)' }}>
              <Search className="w-7 h-7" style={{ color: 'hsl(43 71% 42%)' }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'hsl(0 0% 10%)' }}>Find Agents</h3>
            <p className="text-sm ik-text-muted mb-4">Browse 1,200+ verified agents</p>
            <span className="ik-btn-gold text-sm px-4 py-2">Browse Now</span>
          </Link>

          <Link to={createPageUrl("Inbox")} className="ik-card ik-card-hover p-6 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(217 91% 95%)' }}>
              <MessageSquare className="w-7 h-7" style={{ color: 'hsl(217 91% 60%)' }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'hsl(0 0% 10%)' }}>Messages</h3>
            <p className="text-sm ik-text-muted mb-4">
              {userData.unreadMessages > 0 ? `${userData.unreadMessages} unread messages` : "No new messages"}
            </p>
            <span className="ik-btn-pill text-sm">Open Inbox</span>
          </Link>

          <Link to={createPageUrl("DealRooms")} className="ik-card ik-card-hover p-6 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(270 91% 95%)' }}>
              <FileText className="w-7 h-7" style={{ color: 'hsl(270 60% 55%)' }} />
            </div>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'hsl(0 0% 10%)' }}>Deal Rooms</h3>
            <p className="text-sm ik-text-muted mb-4">
              {userData.activeDealRooms > 0 ? `${userData.activeDealRooms} active room` : "No active rooms"}
            </p>
            <span className="ik-btn-pill text-sm">View Rooms</span>
          </Link>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="ik-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(0 0% 10%)' }}>Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b" style={{ borderColor: 'hsl(0 0% 95%)' }}>
              <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'hsl(0 0% 92%)' }}></div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>Sarah J. viewed your profile</p>
                <p className="text-xs ik-text-muted">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 pb-4 border-b" style={{ borderColor: 'hsl(0 0% 95%)' }}>
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: 'hsl(48 100% 95%)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'hsl(43 71% 42%)' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>New agent match available</p>
                <p className="text-xs ik-text-muted">Yesterday</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'hsl(0 0% 92%)' }}></div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>Michael K. sent you a message</p>
                <p className="text-xs ik-text-muted">2 days ago</p>
              </div>
            </div>
          </div>
        </div>

        <div className="ik-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(0 0% 10%)' }}>Investment Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 flex-shrink-0 ik-text-muted" />
              <div className="flex-1">
                <p className="text-xs ik-text-muted">Asset Type</p>
                <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>Single Family, Land</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 flex-shrink-0 ik-text-muted" />
              <div className="flex-1">
                <p className="text-xs ik-text-muted">Budget Range</p>
                <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>$100,000 - $500,000</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 flex-shrink-0 ik-text-muted" />
              <div className="flex-1">
                <p className="text-xs ik-text-muted">Target Markets</p>
                <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>{profile?.target_state || 'Not set'}</p>
              </div>
            </div>
          </div>
          <Link to={createPageUrl("MyProfile")} className="inline-flex items-center gap-2 text-sm font-medium mt-4" style={{ color: 'hsl(43 71% 42%)' }}>
            Edit Preferences <ArrowRight className="w-4 h-4" />
          </Link>
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