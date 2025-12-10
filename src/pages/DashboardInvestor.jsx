import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { SetupChecklist } from "@/components/SetupChecklist";
import { base44 } from "@/api/base44Client";
import { inboxList } from "@/components/functions";
import { useRooms } from "@/components/useRooms";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, TrendingUp, Plus, MessageSquare, Users,
  Loader2, Sparkles, Home, DollarSign, CreditCard, Bot, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";

function InvestorDashboardContent({ profile: propProfile }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState(propProfile);
  const [recentMessages, setRecentMessages] = useState([]);
  const [suggestedAgents, setSuggestedAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [showAllAgents, setShowAllAgents] = useState(false);
  
  // Sync profile if prop changes
  useEffect(() => {
    if (propProfile) setProfile(propProfile);
  }, [propProfile]);
  
  // Load Rooms (Standard Hook)
  const { data: roomsQuery = [], isLoading: roomsLoading, refetch: refetchRooms } = useRooms();
  // Ensure rooms is always an array
  const rooms = Array.isArray(roomsQuery) ? roomsQuery : [];

  // Load Profile (Fallback if not provided by prop)
  useEffect(() => {
    if (profile) return; // Skip if already have profile
    const loadProfile = async () => {
      try {
        const user = await base44.auth.me();
        if (!user) return;
        const profiles = await base44.entities.Profile.filter({ user_id: user.id });
        setProfile(profiles[0]);
      } catch (error) {
        console.error("Profile load error", error);
      }
    };
    loadProfile();
  }, [profile]);

  // Load Active Deals (Source of Truth)
  const { data: activeDeals = [], isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['investorDeals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      // FIX: Use string sort syntax instead of object, as per instructions
      const deals = await base44.entities.Deal.filter(
         { investor_id: profile.id }, 
         '-created_date',
         20
      );
      // Return active/pipeline deals
      if (!Array.isArray(deals)) return [];
      return deals.filter(d => d && (d.status === 'active' || d.pipeline_stage === 'new_deal_under_contract'));
    },
    enabled: !!profile?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Calculate Orphan Deal (Latest deal not in a connected room)
  const orphanDeal = useMemo(() => {
    if (!activeDeals.length) return null;

    // Get IDs of deals that are in a REAL room (connected to agent)
    // We filter out "orphan" virtual rooms that might come from listMyRooms
    const connectedDealIds = new Set(
        Array.isArray(rooms)
            ? rooms
                .filter(r => r && !r.is_orphan && r.counterparty_role !== 'none' && r.deal_id)
                .map(r => r.deal_id)
            : []
    );

    // Find the newest deal that isn't connected
    // activeDeals is already sorted by created_date desc
    if (!Array.isArray(activeDeals)) return null;
    return activeDeals.find(d => d && d.id && !connectedDealIds.has(d.id));
  }, [activeDeals, rooms]);

  // Load Suggested Agents when orphan deal changes
  useEffect(() => {
    let state = null;
    let dealId = null;

    if (orphanDeal) {
        dealId = orphanDeal.id;
        state = orphanDeal.state;
        // Try extract state from address if missing
        if (!state && orphanDeal.property_address) {
            const parts = orphanDeal.property_address.split(',');
            if (parts.length > 1) {
                const stateZip = parts[parts.length - 1].trim();
                const possibleState = stateZip.split(' ')[0].replace(/[0-9]/g, ''); 
                if (possibleState.length >= 2) state = possibleState;
            }
        }
    }

    // If "Show All" is enabled, ignore state
    if (showAllAgents) {
        loadSuggestedAgents(null, dealId);
    } else {
        loadSuggestedAgents(state, dealId);
    }
  }, [orphanDeal?.id, showAllAgents]);

  const loadSuggestedAgents = async (state, dealId) => {
    setAgentsLoading(true);
    try {
      // 1. Get matches (strict if state provided, broad if null)
      const response = await base44.functions.invoke('matchAgentsForInvestor', {
        state, dealId, limit: 3
      });
      
      const agents = response.data?.results?.map(r => r.profile) || [];
      setSuggestedAgents(agents);
    } catch (err) {
      console.error("Agent load error", err);
      setSuggestedAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  };

  // Messages
  useEffect(() => {
    // Safety wrapper for inboxList
    const fetchMessages = async () => {
      try {
        if (typeof inboxList === 'function') {
           const res = await inboxList();
           if (res && Array.isArray(res.data)) {
             setRecentMessages(res.data.slice(0, 3));
           }
        }
      } catch (err) {
        console.warn("Failed to load messages", err);
      }
    };
    fetchMessages();
  }, []);

  // Stats
  const dealStats = {
    active: Array.isArray(activeDeals) 
      ? activeDeals.filter(d => d && !['closing', 'clear_to_close_closed'].includes(d.pipeline_stage)).length 
      : 0,
    pending: orphanDeal ? 1 : 0,
    closed: Array.isArray(rooms)
      ? rooms.filter(r => r && ['closing', 'clear_to_close_closed'].includes(r.pipeline_stage)).length
      : 0
  };

  const handleRefresh = () => {
    refetchDeals();
    refetchRooms();
    queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };

  if (!profile || dealsLoading || roomsLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  const firstName = profile.full_name?.split(' ')[0] || 'Investor';

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-transparent">
        <div className="max-w-7xl mx-auto px-6 py-12">
          
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#E3C567] mb-2">
                Welcome back, {firstName}!
              </h1>
              <p className="text-base text-[#808080]">
                Track deals, connect with agents, and grow your portfolio.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-[#808080] hover:text-[#E3C567]">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>

          <SetupChecklist profile={profile} onRefresh={() => window.location.reload()} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* BOX 1: ACTION CARD */}
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col hover:border-[#E3C567]/50 transition-all">
               {orphanDeal ? (
                 <>
                   <div className="flex items-start justify-between mb-4">
                     <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center animate-pulse">
                       <FileText className="w-6 h-6 text-[#E3C567]" />
                     </div>
                     <span className="px-3 py-1.5 bg-[#E3C567]/20 text-[#E3C567] text-xs font-medium rounded-full flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-[#E3C567] animate-pulse"></span>
                       Action Required
                     </span>
                   </div>
                   
                   <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">Select an Agent</h3>
                   <p className="text-sm text-[#808080] mb-4">
                     Your deal is ready. Choose an agent below to start the room.
                   </p>

                   <div className="bg-[#141414] rounded-xl p-4 border border-[#E3C567]/30 mb-4">
                      <p className="text-[#FAFAFA] font-bold text-lg mb-1">{orphanDeal.property_address || orphanDeal.title}</p>
                      <div className="flex items-center gap-4 text-xs text-[#808080]">
                         <span>{orphanDeal.city}, {orphanDeal.state}</span>
                         <span className="text-[#E3C567]">${(orphanDeal.purchase_price || 0).toLocaleString()}</span>
                      </div>
                   </div>

                   <Button 
                     onClick={() => navigate(`${createPageUrl("DealWizard")}?dealId=${orphanDeal.id}`)}
                     className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-bold mt-auto"
                   >
                     Match with Agent <Sparkles className="w-4 h-4 ml-2" />
                   </Button>
                 </>
               ) : (
                 <>
                   <div className="flex items-start justify-between mb-4">
                     <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                       <Plus className="w-6 h-6 text-[#E3C567]" />
                     </div>
                     <span className="px-3 py-1.5 bg-[#222] text-[#808080] text-xs font-medium rounded-full border border-[#333]">
                       New Deal
                     </span>
                   </div>
                   <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">Submit New Deal</h3>
                   <p className="text-sm text-[#808080] mb-8">
                     Upload a contract to automatically extract details and match with top agents.
                   </p>
                   <Button 
                     onClick={() => navigate(createPageUrl("DealWizard"))}
                     className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-bold mt-auto"
                   >
                     <Sparkles className="w-4 h-4 mr-2" /> Start Deal Wizard
                   </Button>
                 </>
               )}
            </div>

            {/* BOX 2: PIPELINE */}
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

                <div className="space-y-3 flex-grow">
                    <div className="flex items-center justify-between p-4 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                        <div className="flex items-center gap-3">
                            <Home className="w-4 h-4 text-[#E3C567]" />
                            <span className="text-sm text-[#FAFAFA]">Active Deals</span>
                        </div>
                        <span className="text-xl font-bold text-[#FAFAFA]">{dealStats.active}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                        <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-[#808080]" />
                            <span className="text-sm text-[#FAFAFA]">Pending</span>
                        </div>
                        <span className="text-xl font-bold text-[#808080]">{dealStats.pending}</span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#141414] rounded-xl border border-[#1F1F1F]">
                        <div className="flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-[#FAFAFA]">Closed</span>
                        </div>
                        <span className="text-xl font-bold text-green-500">{dealStats.closed}</span>
                    </div>
                </div>
            </div>

            {/* BOX 3: MESSAGES */}
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#E3C567]/10 rounded-lg flex items-center justify-center text-[#E3C567]">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-[#FAFAFA]">Messages</h3>
                </div>

                <div className="flex-grow space-y-3">
                    {recentMessages.length > 0 ? (
                        recentMessages.map((msg, i) => (
                            <div key={i} className="p-3 bg-[#141414] rounded-xl border border-[#1F1F1F] flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center text-xs font-bold">
                                    {msg.senderName?.[0]}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-[#FAFAFA] truncate">{msg.senderName}</p>
                                    <p className="text-xs text-[#808080] truncate">{msg.preview}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <p className="text-sm text-[#666]">No new messages</p>
                        </div>
                    )}
                </div>
            </div>

            {/* BOX 4: AGENTS */}
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#E3C567]/10 rounded-lg flex items-center justify-center text-[#E3C567]">
                        <Users className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-[#FAFAFA]">
                        {orphanDeal ? 'Recommended Agents' : 'Top Agents'}
                    </h3>
                </div>

                {agentsLoading ? (
                    <div className="flex-grow flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-[#E3C567] animate-spin" />
                    </div>
                ) : suggestedAgents.length > 0 ? (
                    <div className="flex-grow space-y-3">
                        {suggestedAgents.map(agent => {
                            if (!agent) return null;
                            return (
                                <div key={agent.id || Math.random()} className="p-3 bg-[#141414] rounded-xl border border-[#1F1F1F] hover:border-[#E3C567] cursor-pointer transition-colors"
                                     onClick={() => agent.id && navigate(createPageUrl(`AgentProfile?id=${agent.id}`))}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#E3C567]/20 text-[#E3C567] flex items-center justify-center font-bold text-xs">
                                            {agent.full_name ? agent.full_name[0] : 'A'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-[#FAFAFA]">{agent.full_name || 'Unknown Agent'}</p>
                                            <p className="text-xs text-[#808080]">{agent.agent?.brokerage || 'Independent'}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center">
                        <p className="text-sm text-[#666] mb-2">
                           {orphanDeal 
                             ? `No agents found in ${orphanDeal.state || 'this area'} yet.` 
                             : 'Start a deal to see matches.'}
                        </p>
                        {orphanDeal && (
                            <>
                                <p className="text-xs text-[#444] mb-4 max-w-[200px]">
                                    We only show agents verified in the deal's market.
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567] hover:text-black rounded-full text-xs h-8 mb-2"
                                    onClick={() => setShowAllAgents(true)}
                                >
                                    Show Agents from Other Areas
                                </Button>
                            </>
                        )}
                        <Button 
                            variant="link" 
                            className="text-[#808080] text-xs"
                            onClick={() => navigate(createPageUrl("AgentDirectory"))}
                        >
                            Browse Directory
                        </Button>
                    </div>
                )}
            </div>

          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
              {[
                { label: 'Documents', icon: FileText, href: 'InvestorDocuments' },
                { label: 'My Profile', icon: Users, href: 'AccountProfile' },
                { label: 'Subscription', icon: CreditCard, href: 'Pricing' },
                { label: 'AI Assistant', icon: Bot, href: 'AIAssistant' },
              ].map(link => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} to={createPageUrl(link.href)} className="p-4 bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl flex items-center gap-3 hover:bg-[#141414] transition-colors">
                        <Icon className="w-5 h-5 text-[#E3C567]" />
                        <span className="text-sm font-bold text-[#FAFAFA]">{link.label}</span>
                    </Link>
                  )
              })}
          </div>

        </div>
      </div>
    </>
  );
}

import ErrorBoundary from "@/components/ErrorBoundary";

export default function DashboardInvestor({ profile }) {
  return (
    <AuthGuard requireAuth={true}>
      <ErrorBoundary>
        <InvestorDashboardContent profile={profile} />
      </ErrorBoundary>
    </AuthGuard>
  );
}