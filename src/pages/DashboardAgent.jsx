import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { 
  MessageSquare, Users, FileText, TrendingUp, Eye,
  MapPin, ArrowRight
} from "lucide-react";

function AgentDashboardContent() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileCompletion] = useState(75);

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

  const firstName = profile?.full_name?.split(' ')[0] || 'Agent';
  const userData = {
    activeClients: 5,
    pendingRequests: 3,
    unreadMessages: 4,
    profileViews: 12,
    activeDealRooms: 2
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'hsl(0 0% 0%)' }}>
          Your Agent dashboard
        </h1>
        <p className="text-base" style={{ color: 'hsl(0 0% 44%)' }}>
          Track your profile performance and connect with investors.
        </p>
      </header>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="ik-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 44%)' }}>Profile Strength</span>
            <TrendingUp className="w-5 h-5" style={{ color: 'hsl(43 59% 52%)' }} />
          </div>
          <div className="text-3xl font-bold mb-2" style={{ color: 'hsl(0 0% 10%)' }}>{profileCompletion}%</div>
          <div className="ik-progress-bar h-1.5">
            <div className="ik-progress-fill" style={{ width: `${profileCompletion}%` }}></div>
          </div>
        </div>

        <div className="ik-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 44%)' }}>Profile Views</span>
            <Eye className="w-5 h-5" style={{ color: 'hsl(217 91% 60%)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'hsl(0 0% 10%)' }}>{userData.profileViews}</div>
          <p className="text-sm mt-1" style={{ color: 'hsl(142 71% 45%)' }}>+15% this week</p>
        </div>

        <div className="ik-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 44%)' }}>Unread Messages</span>
            <MessageSquare className="w-5 h-5" style={{ color: 'hsl(270 60% 55%)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'hsl(0 0% 10%)' }}>{userData.unreadMessages}</div>
          <Link to={createPageUrl("Inbox")} className="text-sm font-medium mt-1 inline-block hover:underline" style={{ color: 'hsl(43 71% 42%)' }}>View inbox</Link>
        </div>

        <div className="ik-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium" style={{ color: 'hsl(0 0% 44%)' }}>Active Clients</span>
            <Users className="w-5 h-5" style={{ color: 'hsl(142 71% 45%)' }} />
          </div>
          <div className="text-3xl font-bold" style={{ color: 'hsl(0 0% 10%)' }}>{userData.activeClients}</div>
          <p className="text-sm mt-1" style={{ color: 'hsl(0 0% 44%)' }}>{userData.pendingRequests} pending</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <section className="ik-card p-6">
            <h2 className="text-base font-semibold mb-5" style={{ color: 'hsl(0 0% 10%)' }}>Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link to={createPageUrl("InvestorDirectory")} className="group p-4 rounded-xl border-2 text-center transition-all hover:border-amber-300 hover:shadow-sm" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'hsl(48 100% 95%)' }}>
                  <Users className="w-6 h-6" style={{ color: 'hsl(43 71% 42%)' }} />
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'hsl(0 0% 10%)' }}>Find Investors</h3>
                <p className="text-xs" style={{ color: 'hsl(0 0% 44%)' }}>Connect with investors</p>
              </Link>

              <Link to={createPageUrl("Inbox")} className="group p-4 rounded-xl border-2 text-center transition-all hover:border-amber-300 hover:shadow-sm" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'hsl(217 91% 95%)' }}>
                  <MessageSquare className="w-6 h-6" style={{ color: 'hsl(217 91% 60%)' }} />
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'hsl(0 0% 10%)' }}>Messages</h3>
                <p className="text-xs" style={{ color: 'hsl(0 0% 44%)' }}>{userData.unreadMessages} unread</p>
              </Link>

              <Link to={createPageUrl("DealRooms")} className="group p-4 rounded-xl border-2 text-center transition-all hover:border-amber-300 hover:shadow-sm" style={{ borderColor: 'hsl(0 0% 92%)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: 'hsl(270 91% 95%)' }}>
                  <FileText className="w-6 h-6" style={{ color: 'hsl(270 60% 55%)' }} />
                </div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'hsl(0 0% 10%)' }}>Deal Rooms</h3>
                <p className="text-xs" style={{ color: 'hsl(0 0% 44%)' }}>{userData.activeDealRooms} active</p>
              </Link>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="ik-card p-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(0 0% 10%)' }}>Recent Activity</h2>
            <div className="space-y-0 divide-y" style={{ borderColor: 'hsl(0 0% 94%)' }}>
              <div className="flex items-center gap-4 py-3 first:pt-0">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: 'hsl(217 91% 95%)' }}>
                  <Eye className="w-4 h-4" style={{ color: 'hsl(217 91% 60%)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'hsl(0 0% 10%)' }}>An investor viewed your profile</p>
                  <p className="text-xs" style={{ color: 'hsl(0 0% 44%)' }}>1 hour ago</p>
                </div>
              </div>
              <div className="flex items-center gap-4 py-3">
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: 'hsl(48 100% 95%)' }}>
                  <TrendingUp className="w-4 h-4" style={{ color: 'hsl(43 71% 42%)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'hsl(0 0% 10%)' }}>New connection request</p>
                  <p className="text-xs" style={{ color: 'hsl(0 0% 44%)' }}>Yesterday</p>
                </div>
              </div>
              <div className="flex items-center gap-4 py-3 last:pb-0">
                <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'hsl(0 0% 92%)' }}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'hsl(0 0% 10%)' }}>Alex T. sent you a message</p>
                  <p className="text-xs" style={{ color: 'hsl(0 0% 44%)' }}>2 days ago</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Markets & Info */}
          <section className="ik-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: 'hsl(0 0% 10%)' }}>Your Markets</h2>
              <Link to={createPageUrl("MyProfile")} className="text-sm font-medium hover:underline" style={{ color: 'hsl(43 71% 42%)' }}>Edit</Link>
            </div>
            <div className="flex items-start gap-3 mb-4">
              <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(0 0% 69%)' }} />
              <div>
                <dt className="text-xs mb-0.5" style={{ color: 'hsl(0 0% 44%)' }}>Primary Markets</dt>
                <dd className="text-sm font-medium" style={{ color: 'hsl(0 0% 10%)' }}>{profile?.agent?.markets?.join(', ') || 'Not set'}</dd>
              </div>
            </div>
            <Link to={createPageUrl("DealRooms")} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'hsl(43 71% 42%)' }}>
              Manage Clients <ArrowRight className="w-4 h-4" />
            </Link>
          </section>

          {/* Quick Links */}
          <section className="ik-card p-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'hsl(0 0% 10%)' }}>Quick Links</h2>
            <nav className="space-y-1">
              <Link to={createPageUrl("MyProfile")} className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors hover:bg-gray-50">
                <span className="text-sm" style={{ color: 'hsl(0 0% 28%)' }}>My profile</span>
                <ArrowRight className="w-4 h-4" style={{ color: 'hsl(0 0% 69%)' }} />
              </Link>
              <Link to={createPageUrl("InvestorDirectory")} className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors hover:bg-gray-50">
                <span className="text-sm" style={{ color: 'hsl(0 0% 28%)' }}>Browse investors</span>
                <ArrowRight className="w-4 h-4" style={{ color: 'hsl(0 0% 69%)' }} />
              </Link>
              <Link to={createPageUrl("DealRooms")} className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors hover:bg-gray-50">
                <span className="text-sm" style={{ color: 'hsl(0 0% 28%)' }}>Deal rooms</span>
                <ArrowRight className="w-4 h-4" style={{ color: 'hsl(0 0% 69%)' }} />
              </Link>
              <Link to={createPageUrl("Inbox")} className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors hover:bg-gray-50">
                <span className="text-sm" style={{ color: 'hsl(0 0% 28%)' }}>Messages</span>
                <ArrowRight className="w-4 h-4" style={{ color: 'hsl(0 0% 69%)' }} />
              </Link>
            </nav>
          </section>
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