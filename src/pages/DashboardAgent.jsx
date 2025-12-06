import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { SetupChecklist } from "@/components/SetupChecklist";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, Users, FileText, TrendingUp, Eye,
  Loader2, Sparkles, Bot
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
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const state = await response.json();
        if (state.profile) {
          setProfile(state.profile);
          setLoading(false);
          return;
        }
      }
      
      const { base44 } = await import('@/api/base44Client');
      const user = await base44.auth.me();
      if (user) {
        const emailLower = user.email.toLowerCase().trim();
        let profiles = await base44.entities.Profile.filter({ email: emailLower });
        if (!profiles?.length) {
          profiles = await base44.entities.Profile.filter({ user_id: user.id });
        }
        if (profiles?.length > 0) {
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
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin mx-auto mb-4" />
            <p className="text-[#808080] text-sm">Loading your dashboard...</p>
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
      <div className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="space-y-12">
            
            {/* Header */}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#E3C567] mb-2">
                Welcome back, {firstName}!
              </h1>
              <p className="text-base text-[#808080]">
                Track your performance and connect with investors.
              </p>
            </div>

            {/* Setup Checklist */}
            <SetupChecklist profile={profile} onRefresh={loadProfile} />

            {/* 4-Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Box 1: Find Investors */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col hover:shadow-xl hover:border-[#E3C567] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  <span className="px-3 py-1.5 bg-[#34D399]/20 text-[#34D399] text-xs font-medium rounded-full">
                    Primary
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">Find Investors</h3>
                <p className="text-sm text-[#808080] mb-6 flex-grow">
                  Browse verified investors looking for agents in your market.
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
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  <Link to={createPageUrl("MyProfile")} className="text-xs text-[#E3C567] hover:underline">
                    View →
                  </Link>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Performance</h3>
                
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center justify-between p-3 bg-[#E3C567]/10 rounded-lg border border-[#E3C567]/20">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-[#E3C567]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Profile Views</span>
                    </div>
                    <span className="text-lg font-bold text-[#E3C567]">{userData.profileViews}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#262626] rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#808080]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Active Clients</span>
                    </div>
                    <span className="text-lg font-bold text-[#808080]">{userData.activeClients}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#34D399]/10 rounded-lg border border-[#34D399]/20">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#34D399]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Strength</span>
                    </div>
                    <span className="text-lg font-bold text-[#34D399]">{profileCompletion}%</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Messages */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#DB2777]/20 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#DB2777]" />
                  </div>
                  <Link to={createPageUrl("DealRooms")} className="text-xs text-[#E3C567] hover:underline">
                    View all →
                  </Link>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Messages</h3>
                
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#DB2777]/10 border border-[#DB2777]/20">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#DB2777]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Unread</span>
                    </div>
                    <span className="text-lg font-bold text-[#DB2777]">{userData.unreadMessages}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#E3C567]/10 border border-[#E3C567]/20">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#E3C567]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Pending</span>
                    </div>
                    <span className="text-lg font-bold text-[#E3C567]">{userData.pendingRequests}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => navigate(createPageUrl("DealRooms"))}
                  variant="outline"
                  className="w-full mt-4 border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10"
                >
                  Open Rooms
                </Button>
              </div>

              {/* Box 4: New Leads */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  <Link to={createPageUrl("InvestorDirectory")} className="text-xs text-[#E5C37F] hover:underline">
                    View all →
                  </Link>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">New Leads</h3>
                
                <div className="text-center py-8 flex-grow flex flex-col items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[#333333] mb-2" />
                  <p className="text-sm text-[#808080]">No new matches yet</p>
                  <p className="text-xs text-[#666666]">Check back soon</p>
                </div>
                
                <Button 
                  onClick={() => navigate(createPageUrl("InvestorDirectory"))}
                  variant="outline"
                  className="w-full border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10"
                >
                  Browse Investors
                </Button>
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
                    className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl flex items-center gap-2 p-3 hover:border-[#E3C567] hover:bg-[#141414] transition-all"
                  >
                    <div className="w-8 h-8 bg-[#E3C567]/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#E3C567]" />
                    </div>
                    <span className="text-sm font-medium text-[#FAFAFA]">{link.label}</span>
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