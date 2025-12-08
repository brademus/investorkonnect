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
  // const [profileCompletion] = useState(75); // Unused

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
        <div className="min-h-screen bg-transparent flex items-center justify-center">
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
      <div className="min-h-screen bg-transparent">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="space-y-12">
            
            {/* Header */}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#E3C567] mb-2">
                Welcome back, {firstName}!
              </h1>
              <p className="text-base text-[#808080]">
                Manage your inbound deals and track your pipeline.
              </p>
            </div>

            {/* Setup Checklist */}
            <SetupChecklist profile={profile} onRefresh={loadProfile} />

            {/* 4-Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Box 1: My Deals */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col hover:shadow-xl hover:border-[#E3C567] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  <span className="px-3 py-1.5 bg-[#34D399]/20 text-[#34D399] text-xs font-medium rounded-full">
                    Active
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">My Deals</h3>
                <p className="text-sm text-[#808080] mb-6 flex-grow">
                  View and manage deal rooms where investors have sent you contracts.
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl("DealRooms"))}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Deal Rooms
                </Button>
              </div>

              {/* Box 2: Pipeline */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col hover:shadow-xl hover:border-[#E3C567] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  <Link to={createPageUrl("Pipeline")} className="text-xs text-[#E3C567] hover:underline">
                    View full pipeline →
                  </Link>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Pipeline</h3>
                <p className="text-sm text-[#808080] mb-6">
                  Track your active deals through every stage of the transaction.
                </p>
                
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center justify-between p-3 bg-[#E3C567]/10 rounded-lg border border-[#E3C567]/20">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#E3C567]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Active Deals</span>
                    </div>
                    <span className="text-lg font-bold text-[#E3C567]">{userData.activeDealRooms}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-[#262626] rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#808080]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Clients</span>
                    </div>
                    <span className="text-lg font-bold text-[#808080]">{userData.activeClients}</span>
                  </div>
                </div>

                <Button 
                  onClick={() => navigate(createPageUrl("Pipeline"))}
                  variant="outline"
                  className="w-full mt-4 border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10"
                >
                  View Pipeline
                </Button>
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
                  Open Messages
                </Button>
              </div>

              {/* Box 4: How It Works / Status */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#E3C567]" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Incoming Deals</h3>
                
                <div className="flex-grow">
                  <p className="text-sm text-[#808080] mb-4">
                    Deals are automatically matched to you based on your service area.
                  </p>
                  <ul className="text-sm text-[#808080] space-y-3">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-1.5" />
                      <span>Investor uploads contract</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-1.5" />
                      <span>AI matches state & county</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E3C567] mt-1.5" />
                      <span>You receive the deal</span>
                    </li>
                  </ul>
                </div>
                
                <div className="mt-4 p-3 bg-[#262626] rounded-lg">
                  <p className="text-xs text-[#808080] text-center">
                    Make sure your <Link to={createPageUrl("AccountProfile")} className="text-[#E3C567] hover:underline">markets</Link> are up to date.
                  </p>
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