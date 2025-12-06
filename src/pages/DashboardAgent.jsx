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

        {/* Box 3: Recent Messages */}
        <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-[#DB2777]/20 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-[#DB2777]" />
            </div>
            <Link to={createPageUrl("DealRooms")} className="text-sm text-[#E5C37F] hover:underline">
              View all →
            </Link>
          </div>
          <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Recent Messages</h3>
          
          {recentMessages.length > 0 ? (
            <div className="space-y-3">
              {recentMessages.map((msg, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-[#333333] hover:border-[#E5C37F] hover:bg-[#262626] transition-all cursor-pointer">
                  <div className="w-8 h-8 bg-[#E5C37F]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#E5C37F]">
                      {msg.senderName?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#FAFAFA] truncate">{msg.senderName || 'Agent'}</p>
                    <p className="text-xs text-[#A6A6A6] truncate">{msg.preview || 'New message'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <MessageSquare className="w-10 h-10 text-[#333333] mx-auto mb-2" />
              <p className="text-sm text-[#A6A6A6]">No messages yet</p>
              <p className="text-xs text-[#666666]">Start a deal to connect with agents</p>
            </div>
          )}
        </div>

        {/* Box 4: Suggested Agents */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-3xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-[#E3C567]" />
            </div>
            <Link to={createPageUrl("AgentDirectory")} className="text-sm text-[#E5C37F] hover:underline">
              Browse all →
            </Link>
          </div>
          <h3 className="text-lg font-bold text-[#FAFAFA] mb-4">Suggested Agents</h3>
          
          <div className="text-center py-6">
            <Users className="w-10 h-10 text-[#333333] mx-auto mb-2" />
            <p className="text-sm text-[#A6A6A6]">AI matching in progress</p>
            <p className="text-xs text-[#666666]">Complete your profile for better matches</p>
          </div>
          
          <Button 
            onClick={() => navigate(createPageUrl("AgentDirectory"))}
            variant="outline"
            className="w-full mt-4 border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10"
          >
            Browse All Agents
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