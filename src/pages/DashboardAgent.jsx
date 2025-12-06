import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { SetupChecklist } from "@/components/SetupChecklist";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, Users, FileText, TrendingUp, Eye,
  MapPin, Loader2, Sparkles, Bot
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
      // First try the /functions/me endpoint
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
        if (state.profile) {
          console.log('[DashboardAgent] Profile from /functions/me:', state.profile);
          setProfile(state.profile);
          setLoading(false);
          return;
        }
      }
      
      // Fallback: fetch profile directly from entity
      const { base44 } = await import('@/api/base44Client');
      const user = await base44.auth.me();
      if (user) {
        const emailLower = user.email.toLowerCase().trim();
        let profiles = await base44.entities.Profile.filter({ email: emailLower });
        if (!profiles?.length) {
          profiles = await base44.entities.Profile.filter({ user_id: user.id });
        }
        if (profiles?.length > 0) {
          console.log('[DashboardAgent] Profile from direct fetch:', profiles[0]);
          setProfile(profiles[0]);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('[DashboardAgent] Error loading profile:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#E5C37F] animate-spin mx-auto mb-4" />
            <p className="text-[#A6A6A6] text-sm">Loading your dashboard...</p>
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
      <div className="min-h-screen bg-[#0F0F0F]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-6 lg:space-y-8">
            
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#E5C37F]">
                  Welcome back, {firstName}!
                </h1>
                <p className="mt-2 text-base text-[#A6A6A6]">
                  Track your profile performance and connect with investors.
                </p>
              </div>
            </div>

            {/* Setup Checklist */}
            <SetupChecklist profile={profile} onRefresh={loadProfile} />

            {/* 4-Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              
              {/* Box 1: Find Investors */}
              <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6 hover:shadow-[0_10px_25px_rgba(229,195,127,0.2)] hover:border-[#E5C37F] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E5C37F]/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#E5C37F]" />
                  </div>
                  <span className="px-3 py-1 bg-[#34D399]/20 text-[#34D399] text-xs font-medium rounded-full border border-[#34D399]/30">
                    Primary Action
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">Find Investors</h3>
                <p className="text-sm text-[#A6A6A6] mb-4">
                  Browse and connect with verified investors looking for agents in your market.
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl("InvestorDirectory"))}
                  className="w-full bg-gradient-to-r from-[#E5C37F] to-[#C9A961] hover:from-[#F0D699] hover:to-[#D4AF37] text-[#0F0F0F] rounded-full"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Browse Investors
                </Button>
              </div>

              {/* Box 2: Performance Stats */}
              <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E5C37F]/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#E5C37F]" />
                  </div>
                  <Link to={createPageUrl("MyProfile")} className="text-sm text-[#E5C37F] hover:underline">
                    View profile →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Your Performance</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#E5C37F]/20 rounded-lg border border-[#E5C37F]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#E5C37F] rounded-lg flex items-center justify-center">
                        <Eye className="w-4 h-4 text-[#0F0F0F]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Profile Views</span>
                    </div>
                    <span className="text-xl font-bold text-[#E5C37F]">{userData.profileViews}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#262626] rounded-lg border border-[#333333]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#666666] rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#FAFAFA]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Active Clients</span>
                    </div>
                    <span className="text-xl font-bold text-[#A6A6A6]">{userData.activeClients}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#34D399]/20 rounded-lg border border-[#34D399]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#34D399] rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-[#0F0F0F]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Profile Strength</span>
                    </div>
                    <span className="text-xl font-bold text-[#34D399]">{profileCompletion}%</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Messages */}
              <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#DB2777]/20 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#DB2777]" />
                  </div>
                  <Link to={createPageUrl("DealRooms")} className="text-sm text-[#E5C37F] hover:underline">
                    View all →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Messages & Requests</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#333333] hover:border-[#DB2777] hover:bg-[#262626] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#DB2777]/20 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-[#DB2777]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Unread Messages</span>
                    </div>
                    <span className="text-xl font-bold text-[#DB2777]">{userData.unreadMessages}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#333333] hover:border-[#E5C37F] hover:bg-[#262626] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#E5C37F]/20 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#E5C37F]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Pending Requests</span>
                    </div>
                    <span className="text-xl font-bold text-[#E5C37F]">{userData.pendingRequests}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => navigate(createPageUrl("DealRooms"))}
                  variant="outline"
                  className="w-full mt-4 border-[#E5C37F] text-[#E5C37F] hover:bg-[#E5C37F]/10"
                >
                  Open Deal Rooms
                </Button>
              </div>

              {/* Box 4: Your Markets */}
              <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-[#34D399]/20 rounded-xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-[#34D399]" />
                    </div>
                  </div>
                  <Link to={createPageUrl("AccountProfile")} className="text-sm text-[#E5C37F] hover:underline">
                    Edit →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Your Markets</h3>
                
                <div className="space-y-3">
                  <div className="p-4 bg-[#262626] rounded-xl border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Primary Markets</p>
                    <p className="font-semibold text-[#FAFAFA]">
                      {profile?.agent?.markets?.join(', ') || profile?.target_state || 'Not set'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-[#262626] rounded-xl border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Experience</p>
                    <p className="font-semibold text-[#FAFAFA]">
                      {profile?.agent?.experience_years ? `${profile.agent.experience_years}+ years` : 'Not set'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-[#262626] rounded-xl border border-[#333333]">
                    <p className="text-xs text-[#A6A6A6] uppercase tracking-wide mb-1">Specialties</p>
                    <p className="font-semibold text-[#FAFAFA]">
                      {profile?.agent?.specialties?.slice(0, 2).join(', ') || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
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
                    className="bg-[#1A1A1A] border border-[#333333] rounded-xl flex items-center gap-3 p-4 hover:border-[#E5C37F] hover:bg-[#262626] transition-all"
                  >
                    <div className="w-8 h-8 bg-[#E5C37F]/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#E5C37F]" />
                    </div>
                    <span className="font-medium text-[#FAFAFA]">{link.label}</span>
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