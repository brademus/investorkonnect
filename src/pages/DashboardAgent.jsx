import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { SetupChecklist } from "@/components/SetupChecklist";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, Users, FileText, TrendingUp, Eye,
  Sparkles, Bot, DollarSign, Clock, Plus, Home
} from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { useRooms } from "@/components/useRooms";
import { inboxList } from "@/components/functions";
import { useQuery } from "@tanstack/react-query";

function AgentDashboardContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Load agent deals
  const { data: agentDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['agentDeals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const deals = await base44.entities.Deal.filter({ 
        agent_id: profile.id 
      });
      return deals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!profile?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  // Real Data Fetching
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  
  const { data: inbox = [], isLoading: inboxLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => {
      try {
        const res = await inboxList();
        return res.data || [];
      } catch (e) {
        console.error("Inbox load failed:", e);
        return [];
      }
    },
    refetchInterval: 2000, // Poll every 2 seconds
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

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

  const firstName = profile?.full_name?.split(' ')[0] || 'Agent';
  const isLoading = (loading || roomsLoading || inboxLoading || dealsLoading) && rooms.length === 0;

  if (isLoading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-transparent flex items-center justify-center">
          <div className="text-center">
            <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
            <p className="text-[#808080] text-sm">Loading your dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  // Calculate Real Stats from deals
  const activeDeals = Array.isArray(agentDeals) 
    ? agentDeals.filter(d => !['clear_to_close_closed', 'closed', 'cancelling_deal'].includes(d.pipeline_stage)) 
    : [];

  const dealStats = {
    new_deal: activeDeals.filter(d => d.pipeline_stage === 'new_deal_under_contract').length,
    walkthrough: activeDeals.filter(d => d.pipeline_stage === 'walkthrough_scheduled').length,
    evaluate: activeDeals.filter(d => d.pipeline_stage === 'evaluate_deal').length,
    marketing: activeDeals.filter(d => d.pipeline_stage === 'active_marketing').length,
    closed: Array.isArray(agentDeals) 
      ? agentDeals.filter(d => ['clear_to_close_closed', 'closed', 'cancelling_deal'].includes(d.pipeline_stage)).length 
      : 0
  };

  const pendingRequests = inbox.filter(i => i.status === 'pending');
  const uniqueClients = new Set(activeDeals.map(d => d.investor_id).filter(Boolean)).size;
  
  // Count unread messages from rooms
  const unreadCount = rooms.filter(r => {
    // Count rooms with messages you haven't read
    return r.last_message && r.last_message.sender_profile_id !== profile?.id;
  }).length;

  const userData = {
    activeClients: uniqueClients,
    pendingRequests: pendingRequests.length,
    unreadMessages: unreadCount,
    profileViews: 0,
    activeDealRooms: activeDeals.length,
    closedDeals: dealStats.closed
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
              
              {/* Box 1: Pipeline Overview */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#E3C567]/10 rounded-lg flex items-center justify-center text-[#E3C567]">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-[#FAFAFA]">Pipeline</h3>
                  </div>
                  <Link to={createPageUrl("Pipeline")} className="text-xs text-[#E3C567] hover:underline">View All</Link>
                </div>

                {isLoading ? (
                  <div className="space-y-2 flex-grow">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-14 bg-[#141414] rounded-xl animate-pulse"></div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 flex-grow overflow-y-auto">
                    {[
                      { label: 'New Deal', count: dealStats.new_deal, color: 'text-[#E3C567]', icon: Plus, bg: 'bg-[#E3C567]/10' },
                      { label: 'Walkthrough Scheduled', count: dealStats.walkthrough, color: 'text-[#E3C567]', icon: Home, bg: 'bg-[#E3C567]/10' },
                      { label: 'Evaluate Deal', count: dealStats.evaluate, color: 'text-[#E3C567]', icon: FileText, bg: 'bg-[#E3C567]/10' },
                      { label: 'Active Marketing', count: dealStats.marketing, color: 'text-[#E3C567]', icon: Users, bg: 'bg-[#E3C567]/10' },
                      { label: 'Closed', count: dealStats.closed, color: 'text-[#808080]', icon: DollarSign, bg: 'bg-[#808080]/10' }
                    ].map((stat, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[#141414] rounded-xl border border-[#1F1F1F] hover:border-[#333] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.bg}`}>
                            <stat.icon className={`w-4 h-4 ${stat.color}`} />
                          </div>
                          <span className="text-sm font-medium text-[#FAFAFA]">{stat.label}</span>
                        </div>
                        <span className={`text-base font-bold ${stat.color}`}>{stat.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 2: Things to Do Today */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-[#E3C567]" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Things to Do Today</h3>
                <p className="text-sm text-[#808080] mb-4">
                  Your action items across all active deals
                </p>
                
                <div className="space-y-2 flex-grow overflow-y-auto">
                  {activeDeals.length > 0 ? (
                    activeDeals.slice(0, 5).map((deal) => {
                      const dealRoom = rooms.find(r => r.deal_id === deal.id);
                      return (
                        <button
                          key={deal.id}
                          onClick={() => {
                            if (dealRoom) {
                              navigate(`${createPageUrl("Room")}?roomId=${dealRoom.id}`);
                            }
                          }}
                          className="w-full text-left p-3 bg-[#141414] rounded-lg border border-[#1F1F1F] hover:border-[#E3C567] transition-all group"
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded border border-[#1F1F1F] bg-[#0D0D0D] mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#FAFAFA] truncate">
                                Follow up: {deal.property_address || deal.title}
                              </p>
                              <p className="text-xs text-[#808080] mt-0.5">
                                Investor: {dealRoom?.counterparty_name || 'N/A'} • Stage: {deal.pipeline_stage?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-[#808080]">No active deals today</p>
                      <p className="text-xs text-[#666666] mt-1">Tasks will appear here as deals come in</p>
                    </div>
                  )}
                </div>

                {activeDeals.length > 5 && (
                  <p className="text-xs text-[#808080] mt-3 text-center">
                    +{activeDeals.length - 5} more tasks in pipeline
                  </p>
                )}
              </div>

              {/* Box 3: Messages */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#E3C567]" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Messages</h3>
                
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#E3C567]/10 border border-[#E3C567]/20">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#E3C567]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Unread Messages</span>
                    </div>
                    <span className="text-lg font-bold text-[#E3C567]">{userData.unreadMessages}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#E3C567]/10 border border-[#E3C567]/20">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#E3C567]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Active Conversations</span>
                    </div>
                    <span className="text-lg font-bold text-[#E3C567]">{rooms.length}</span>
                  </div>

                  {/* Show recent messages */}
                  <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                    {rooms.slice(0, 3).map(room => {
                      const lastMsg = room.last_message?.body || room.last_message_text;
                      const hasUnread = room.last_message && room.last_message.sender_profile_id !== profile?.id;
                      
                      return (
                        <button
                          key={room.id}
                          onClick={() => navigate(`${createPageUrl("Room")}?roomId=${room.id}`)}
                          className={`w-full text-left p-2 rounded-lg hover:bg-[#1F1F1F] transition-colors border ${
                            hasUnread 
                              ? 'bg-[#E3C567]/10 border-[#E3C567]/30' 
                              : 'bg-[#141414] border-[#1F1F1F] hover:border-[#E3C567]'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-xs font-semibold text-[#FAFAFA] truncate">
                              {room.counterparty_name || 'New Message'}
                            </p>
                            {hasUnread && (
                              <div className="w-2 h-2 bg-[#E3C567] rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-[#808080] truncate">
                            {lastMsg || room.property_address || room.deal_title || 'No messages yet'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <Button 
                  onClick={() => {
                    if (rooms.length > 0) {
                      navigate(`${createPageUrl("Room")}?roomId=${rooms[0].id}`);
                    }
                  }}
                  className="w-full mt-4 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                >
                  View All Messages
                </Button>
              </div>

              {/* Box 4: Incoming Deals */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#E3C567]" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Incoming Deals</h3>
                
                <div className="flex-grow space-y-3">
                  {/* Show recent deals awaiting response */}
                  {rooms.filter(r => !r.deal_assigned_agent_id).length > 0 ? (
                    <>
                      <p className="text-sm text-[#808080] mb-3">New deals waiting for your response:</p>
                      {rooms.filter(r => !r.deal_assigned_agent_id).slice(0, 3).map(room => (
                        <button
                          key={room.id}
                          onClick={() => navigate(`${createPageUrl("Room")}?roomId=${room.id}`)}
                          className="w-full text-left p-3 bg-[#E3C567]/10 rounded-lg hover:bg-[#E3C567]/20 transition-colors border border-[#E3C567]/20"
                        >
                          <p className="text-sm font-semibold text-[#E3C567] truncate">
                            {room.property_address || room.deal_title || 'New Deal'}
                          </p>
                          <p className="text-xs text-[#808080] mt-1">
                            From: {room.counterparty_name || 'Investor'}
                          </p>
                          {room.budget && (
                            <p className="text-xs text-[#34D399] font-semibold mt-1">
                              ${room.budget.toLocaleString()}
                            </p>
                          )}
                        </button>
                      ))}
                    </>
                  ) : (
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
                  )}
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