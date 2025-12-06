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
        <div className="min-h-screen bg-[#151311] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#C9A961] animate-spin mx-auto mb-4" />
            <p className="text-[#9E9E9E] text-sm">Loading your dashboard...</p>
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
      <div className="min-h-screen bg-[#151311]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="space-y-6 lg:space-y-8">
            
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-[#C9A961]">
                  Welcome back, {firstName}!
                </h1>
                <p className="mt-2 text-base text-[#9E9E9E]">
                  Track your profile performance and connect with investors.
                </p>
              </div>
            </div>

            {/* Setup Checklist */}
            <SetupChecklist profile={profile} onRefresh={loadProfile} />

            {/* 4-Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              
              {/* Box 1: Find Investors */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6 hover:shadow-[0_10px_25px_rgba(227,197,103,0.2)] hover:border-[#E3C567] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  <span className="px-3 py-1 bg-[#34D399]/20 text-[#34D399] text-xs font-medium rounded-full border border-[#34D399]/30">
                    Primary Action
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">Find Investors</h3>
                <p className="text-sm text-[#808080] mb-4">
                  Browse and connect with verified investors looking for agents in your market.
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl("InvestorDirectory"))}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Browse Investors
                </Button>
              </div>

              {/* Box 2: Performance Stats */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  <Link to={createPageUrl("MyProfile")} className="text-sm text-[#E3C567] hover:underline">
                    View profile →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Your Performance</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#E3C567]/20 rounded-lg border border-[#E3C567]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#E3C567] rounded-lg flex items-center justify-center">
                        <Eye className="w-4 h-4 text-black" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Profile Views</span>
                    </div>
                    <span className="text-xl font-bold text-[#E3C567]">{userData.profileViews}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#666666] rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#FAFAFA]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Active Clients</span>
                    </div>
                    <span className="text-xl font-bold text-[#808080]">{userData.activeClients}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#34D399]/20 rounded-lg border border-[#34D399]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#34D399] rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-black" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Profile Strength</span>
                    </div>
                    <span className="text-xl font-bold text-[#34D399]">{profileCompletion}%</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Messages */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#DB2777]/20 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#DB2777]" />
                  </div>
                  <Link to={createPageUrl("DealRooms")} className="text-sm text-[#E3C567] hover:underline">
                    View all →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Messages & Requests</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#1F1F1F] hover:border-[#DB2777] hover:bg-[#141414] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#DB2777]/20 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-[#DB2777]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Unread Messages</span>
                    </div>
                    <span className="text-xl font-bold text-[#DB2777]">{userData.unreadMessages}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border border-[#1F1F1F] hover:border-[#E3C567] hover:bg-[#141414] transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#E3C567]" />
                      </div>
                      <span className="font-medium text-[#FAFAFA]">Pending Requests</span>
                    </div>
                    <span className="text-xl font-bold text-[#E3C567]">{userData.pendingRequests}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => navigate(createPageUrl("DealRooms"))}
                  variant="outline"
                  className="w-full mt-4 border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10"
                >
                  Open Deal Rooms
                </Button>
              </div>

              {/* Box 4: Your Markets */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 bg-[#34D399]/20 rounded-xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-[#34D399]" />
                    </div>
                  </div>
                  <Link to={createPageUrl("AccountProfile")} className="text-sm text-[#E3C567] hover:underline">
                    Edit →
                  </Link>
                </div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Your Markets</h3>
                
                <div className="space-y-3">
                  <div className="p-4 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                    <p className="text-xs text-[#808080] uppercase tracking-wide mb-1">Primary Markets</p>
                    <p className="font-semibold text-[#FAFAFA]">
                      {profile?.agent?.markets?.join(', ') || profile?.target_state || 'Not set'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                    <p className="text-xs text-[#808080] uppercase tracking-wide mb-1">Experience</p>
                    <p className="font-semibold text-[#FAFAFA]">
                      {profile?.agent?.experience_years ? `${profile.agent.experience_years}+ years` : 'Not set'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                    <p className="text-xs text-[#808080] uppercase tracking-wide mb-1">Specialties</p>
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
                    className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl flex items-center gap-3 p-4 hover:border-[#E3C567] hover:bg-[#141414] transition-all"
                  >
                    <div className="w-8 h-8 bg-[#E3C567]/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#E3C567]" />
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