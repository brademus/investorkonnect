import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { SetupChecklist } from "@/components/SetupChecklist";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, Users, FileText, TrendingUp, Eye,
  MapPin, Loader2, Sparkles, CreditCard, Bot
} from "lucide-react";

function AgentDashboardContent() {
  const navigate = useNavigate();
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
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
            <p className="text-[#6B7280] text-sm">Loading your dashboard...</p>
          </div>
        </div>
      </>
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
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-6 lg:space-y-8">
            
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#111827]">
                  Welcome back, {firstName}!
                </h1>
                <p className="mt-2 text-base text-[#6B7280]">
                  Track your profile performance and connect with investors.
                </p>
              </div>
            </div>

            {/* Setup Checklist */}
            <SetupChecklist profile={profile} onRefresh={loadProfile} />

            {/* 4-Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              
              {/* Box 1: Find Investors */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#D3A029]" />
                  </div>
                  <span className="px-3 py-1 bg-[#D1FAE5] text-[#065F46] text-xs font-medium rounded-full">
                    Primary Action
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#111827] mb-2">Find Investors</h3>
                <p className="text-sm text-[#6B7280] mb-4">
                  Browse and connect with verified investors looking for agents in your market.
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl("InvestorDirectory"))}
                  className="w-full bg-[#D3A029] hover:bg-[#B8902A] text-white"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Browse Investors
                </Button>
              </div>

              {/* Box 2: Performance Stats */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E0E7FF] rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#4F46E5]" />
                  </div>
                  <Link to={createPageUrl("MyProfile")} className="text-sm text-[#D3A029] hover:underline">
                    View profile →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#111827] mb-4">Your Performance</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#FEF3C7] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#D3A029] rounded-lg flex items-center justify-center">
                        <Eye className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-[#111827]">Profile Views</span>
                    </div>
                    <span className="text-xl font-bold text-[#D3A029]">{userData.profileViews}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-400 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-[#111827]">Active Clients</span>
                    </div>
                    <span className="text-xl font-bold text-slate-600">{userData.activeClients}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#D1FAE5] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-[#111827]">Profile Strength</span>
                    </div>
                    <span className="text-xl font-bold text-[#10B981]">{profileCompletion}%</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Messages */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#FCE7F3] rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#DB2777]" />
                  </div>
                  <Link to={createPageUrl("DealRooms")} className="text-sm text-[#D3A029] hover:underline">
                    View all →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#111827] mb-4">Messages & Requests</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#FCE7F3] rounded-full flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-[#DB2777]" />
                      </div>
                      <span className="font-medium text-[#111827]">Unread Messages</span>
                    </div>
                    <span className="text-xl font-bold text-[#DB2777]">{userData.unreadMessages}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#FEF3C7] rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#D3A029]" />
                      </div>
                      <span className="font-medium text-[#111827]">Pending Requests</span>
                    </div>
                    <span className="text-xl font-bold text-[#D3A029]">{userData.pendingRequests}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => navigate(createPageUrl("DealRooms"))}
                  variant="outline"
                  className="w-full mt-4 border-[#D3A029] text-[#D3A029] hover:bg-[#FFFBEB]"
                >
                  Open Deal Rooms
                </Button>
              </div>

              {/* Box 4: Your Markets */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-[#D1FAE5] rounded-xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-[#10B981]" />
                    </div>
                  </div>
                  <Link to={createPageUrl("AccountProfile")} className="text-sm text-[#D3A029] hover:underline">
                    Edit →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#111827] mb-4">Your Markets</h3>
                
                <div className="space-y-3">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-[#6B7280] uppercase tracking-wide mb-1">Primary Markets</p>
                    <p className="font-semibold text-[#111827]">
                      {profile?.agent?.markets?.join(', ') || profile?.target_state || 'Not set'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-[#6B7280] uppercase tracking-wide mb-1">Experience</p>
                    <p className="font-semibold text-[#111827]">
                      {profile?.agent?.experience_years ? `${profile.agent.experience_years}+ years` : 'Not set'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-[#6B7280] uppercase tracking-wide mb-1">Specialties</p>
                    <p className="font-semibold text-[#111827]">
                      {profile?.agent?.specialties?.slice(0, 2).join(', ') || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Subscription', icon: CreditCard, href: 'Pricing' },
                { label: 'My Profile', icon: Users, href: 'AccountProfile' },
                { label: 'Deal Rooms', icon: MessageSquare, href: 'DealRooms' },
                { label: 'Documents', icon: FileText, href: 'AgentDocuments' },
                { label: 'AI Assistant', icon: Bot, href: 'AIAssistant' },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link 
                    key={link.href} 
                    to={createPageUrl(link.href)} 
                    className="bg-white border border-gray-200 rounded-xl flex items-center gap-3 p-4 hover:border-[#D3A029] hover:bg-[#FFFBEB] transition-all"
                  >
                    <div className="w-8 h-8 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#D3A029]" />
                    </div>
                    <span className="font-medium text-[#374151]">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardAgent() {
  return (
    <AuthGuard requireAuth={true}>
      <AgentDashboardContent />
    </AuthGuard>
  );
}