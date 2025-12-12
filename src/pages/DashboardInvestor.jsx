import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
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
import LoadingAnimation from "@/components/LoadingAnimation";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ErrorBoundary";
import { requireInvestorSetup } from "@/components/requireInvestorSetup";
import { toast } from "sonner";

function InvestorDashboardContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [recentMessages, setRecentMessages] = useState([]);
  const [suggestedAgents, setSuggestedAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [showAllAgents, setShowAllAgents] = useState(false);
  
  // Load Rooms (Standard Hook) - Show cached data immediately
  const { data: roomsQuery = [], isLoading: roomsLoading, refetch: refetchRooms } = useRooms();
  const rooms = Array.isArray(roomsQuery) ? roomsQuery : [];

  // Load investor deals - INSTANT with aggressive caching
  const { data: investorDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['investorDeals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const deals = await base44.entities.Deal.filter({ 
        investor_id: profile.id
      });
      return deals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!profile?.id,
    staleTime: Infinity, // Never consider stale - show cached data instantly
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    initialData: [] // Show empty state immediately
  });

  // Orphan deal = deal without agent_id (source of truth from Deal entity)
  const orphanDeal = useMemo(() => {
    if (!investorDeals || investorDeals.length === 0) return null;
    
    // Find first deal without an agent
    return investorDeals.find(d => !d.agent_id) || null;
  }, [investorDeals]);

  // Load Suggested Agents ONLY when there's an orphan deal
  useEffect(() => {
    // If no orphan deal, clear agents and don't load
    if (!orphanDeal) {
      setSuggestedAgents([]);
      return;
    }

    let state = orphanDeal.state;
    let county = orphanDeal.county;
    const dealId = orphanDeal.deal_id || orphanDeal.id;

    // Try extract state from address if missing
    if (!state && orphanDeal.property_address) {
        const parts = orphanDeal.property_address.split(',');
        if (parts.length > 1) {
            const stateZip = parts[parts.length - 1].trim();
            const possibleState = stateZip.split(' ')[0].replace(/[0-9]/g, ''); 
            if (possibleState.length >= 2) state = possibleState;
        }
    }

    // If "Show All" is enabled, ignore territory
    if (showAllAgents) {
        loadSuggestedAgents(null, null, dealId);
    } else {
        loadSuggestedAgents(state, county, dealId);
    }
  }, [orphanDeal?.id, showAllAgents]);

  const loadSuggestedAgents = async (state, county, dealId) => {
    setAgentsLoading(true);
    try {
      const response = await base44.functions.invoke('matchAgentsForInvestor', {
        state, county, dealId, limit: 3
      });
      
      const agents = response.data?.results?.map(r => r.profile) || [];
      setSuggestedAgents(agents);
    } catch (err) {
      console.warn("Agent matching function failed, falling back to agent profiles", err);
      
      try {
          // Fetch recent agent profiles
          const allAgents = await base44.entities.Profile.filter({ user_role: 'agent' }, '-created_date', 50);
          
          let filteredAgents = allAgents;
          
          // Filter by state if available
          if (state) {
              const stateUpper = state.trim().toUpperCase();
              filteredAgents = allAgents.filter(agent => {
                  const markets = agent.agent?.markets || [];
                  return markets.some(m => m.toUpperCase().includes(stateUpper));
              });
          }
          
          // Prioritize county matches if county exists
          if (county && filteredAgents.length > 0) {
              const countyUpper = county.trim().toUpperCase();
              const countyMatches = filteredAgents.filter(agent => {
                  const markets = agent.agent?.markets || [];
                  return markets.some(m => m.toUpperCase().includes(countyUpper));
              });
              
              if (countyMatches.length > 0) {
                  filteredAgents = countyMatches;
              }
          }
          
          // Take top 3
          setSuggestedAgents(filteredAgents.slice(0, 3));
      } catch (fallbackErr) {
          console.error("Fallback query failed", fallbackErr);
          setSuggestedAgents([]);
      }
    } finally {
      setAgentsLoading(false);
    }
  };

  // Messages - Show rooms immediately, load message previews async
  useEffect(() => {
    const activeRooms = rooms.filter(r => 
      r.deal_id && 
      !r.is_orphan && 
      r.deal_assigned_agent_id &&
      r.counterparty_name &&
      r.counterparty_name !== 'Unknown'
    );
    
    if (activeRooms.length === 0) {
      setRecentMessages([]);
      return;
    }

    // Show rooms IMMEDIATELY with placeholder previews
    const immediateMessages = activeRooms.slice(0, 3).map(room => ({
      roomId: room.id,
      senderName: room.counterparty_name,
      dealTitle: room.property_address || room.title || room.deal_title,
      preview: 'Loading...',
      hasMessages: false,
      timestamp: room.created_date
    }));
    
    setRecentMessages(immediateMessages);

    // Load message previews in background
    Promise.all(
      activeRooms.slice(0, 3).map(async (room) => {
        try {
          const messages = await base44.entities.Message.filter(
            { room_id: room.id },
            '-created_date',
            1
          );
          
          return {
            roomId: room.id,
            senderName: room.counterparty_name,
            dealTitle: room.property_address || room.title || room.deal_title,
            preview: messages.length > 0 
              ? messages[0].body?.substring(0, 50) || 'New message'
              : 'Start conversation',
            hasMessages: messages.length > 0,
            timestamp: messages[0]?.created_date || room.created_date
          };
        } catch {
          return {
            roomId: room.id,
            senderName: room.counterparty_name,
            dealTitle: room.property_address || room.title || room.deal_title,
            preview: 'Open chat',
            hasMessages: false,
            timestamp: room.created_date
          };
        }
      })
    ).then(results => setRecentMessages(results));
  }, [rooms]);

  // Stats - only count active/locked-in deals
  // Active = has deal_id, not orphan, AND has locked-in agent (deal_assigned_agent_id exists)
  // Pipeline stages: new_deal_under_contract, walkthrough_scheduled, evaluate_deal, active_marketing
  // Closed stages: clear_to_close_closed, closed, cancelling_deal
  const activeDealRooms = Array.isArray(rooms) 
    ? rooms.filter(r => 
        r.deal_id && 
        !r.is_orphan && 
        r.deal_assigned_agent_id && 
        !['clear_to_close_closed', 'closed', 'cancelling_deal'].includes(r.pipeline_stage)
      ) 
    : [];

  const dealStats = {
    new_deal: activeDealRooms.filter(r => r.pipeline_stage === 'new_deal_under_contract').length,
    walkthrough: activeDealRooms.filter(r => r.pipeline_stage === 'walkthrough_scheduled').length,
    evaluate: activeDealRooms.filter(r => r.pipeline_stage === 'evaluate_deal').length,
    marketing: activeDealRooms.filter(r => r.pipeline_stage === 'active_marketing').length,
    closed: Array.isArray(rooms) 
      ? rooms.filter(r => 
          r.deal_id && 
          r.deal_assigned_agent_id && 
          ['clear_to_close_closed', 'closed'].includes(r.pipeline_stage)
        ).length 
      : 0
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
    refetchRooms();
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Investor';
  const isLoading = (profileLoading || roomsLoading || dealsLoading) && rooms.length === 0;

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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={isLoading}
              className="text-[#808080] hover:text-[#E3C567] disabled:opacity-50"
            >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> 
                Refresh
            </Button>
          </div>

          {profile && <SetupChecklist profile={profile} onRefresh={() => window.location.reload()} />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* BOX 1: ACTION CARD */}
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col hover:border-[#E3C567]/50 transition-all">
               {isLoading ? (
                 <>
                   <div className="flex items-start justify-between mb-4">
                     <div className="w-12 h-12 bg-[#1F1F1F] rounded-xl animate-pulse"></div>
                     <div className="h-6 w-24 bg-[#1F1F1F] rounded-full animate-pulse"></div>
                   </div>
                   <div className="h-6 w-3/4 bg-[#1F1F1F] rounded animate-pulse mb-2"></div>
                   <div className="h-4 w-full bg-[#1F1F1F] rounded animate-pulse mb-4"></div>
                   <div className="h-20 bg-[#141414] rounded-xl animate-pulse mb-4"></div>
                   <div className="h-12 bg-[#1F1F1F] rounded-full animate-pulse mt-auto"></div>
                 </>
               ) : orphanDeal ? (
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
                      <p className="text-[#FAFAFA] font-bold text-lg mb-1">{orphanDeal.property_address || orphanDeal.title || 'New Deal'}</p>
                      <div className="flex items-center gap-4 text-xs text-[#808080]">
                         {orphanDeal.city && orphanDeal.state && (
                           <span>{orphanDeal.city}, {orphanDeal.state}</span>
                         )}
                         {orphanDeal.purchase_price > 0 && (
                           <span className="text-[#E3C567]">${orphanDeal.purchase_price.toLocaleString()}</span>
                         )}
                      </div>
                      {!orphanDeal.county && (
                        <p className="text-xs text-[#F59E0B] mt-2 flex items-center gap-1">
                          ⚠️ County missing — open Deal Wizard to confirm details
                        </p>
                      )}
                   </div>

                   <Button 
                     onClick={() => navigate(`${createPageUrl("AgentDirectory")}?dealId=${orphanDeal.id}`)}
                     className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-bold mt-auto"
                   >
                     Choose Agent <Sparkles className="w-4 h-4 ml-2" />
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
                     onClick={async () => {
                       const check = await requireInvestorSetup({ profile });
                       if (!check.ok) {
                         toast.error(check.message);
                         navigate(createPageUrl(check.redirectTo));
                         return;
                       }
                       navigate(createPageUrl("DealWizard"));
                     }}
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

                {isLoading ? (
                  <div className="space-y-2 flex-grow">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-14 bg-[#141414] rounded-xl animate-pulse"></div>
                    ))}
                  </div>
                ) : (
                <div className="space-y-2 flex-grow overflow-y-auto">
                    {[
                        { label: 'New Deal', count: dealStats.new_deal, color: 'text-[#FAFAFA]', icon: Plus, bg: 'bg-[#FAFAFA]/10' },
                        { label: 'Walkthrough Scheduled', count: dealStats.walkthrough, color: 'text-[#60A5FA]', icon: Home, bg: 'bg-[#60A5FA]/10' },
                        { label: 'Evaluate Deal', count: dealStats.evaluate, color: 'text-[#F59E0B]', icon: FileText, bg: 'bg-[#F59E0B]/10' },
                        { label: 'Active Marketing', count: dealStats.marketing, color: 'text-[#DB2777]', icon: Users, bg: 'bg-[#DB2777]/10' },
                        { label: 'Closed', count: dealStats.closed, color: 'text-[#34D399]', icon: DollarSign, bg: 'bg-[#34D399]/10' }
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

            {/* BOX 3: MESSAGES */}
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#E3C567]/10 rounded-lg flex items-center justify-center text-[#E3C567]">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-[#FAFAFA]">Messages</h3>
                </div>

                {isLoading ? (
                  <div className="flex-grow space-y-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="h-20 bg-[#141414] rounded-xl animate-pulse"></div>
                    ))}
                  </div>
                ) : (
                <div className="flex-grow space-y-3">
                    {recentMessages.length > 0 ? (
                        recentMessages.map((msg, i) => (
                            <div 
                                key={msg.roomId || i} 
                                onClick={() => navigate(`${createPageUrl("Room")}?roomId=${msg.roomId}`)}
                                className="p-3 bg-[#141414] rounded-xl border border-[#1F1F1F] hover:border-[#E3C567] cursor-pointer transition-all group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#E3C567]/20 flex items-center justify-center text-sm font-bold text-[#E3C567] flex-shrink-0">
                                        {msg.senderName?.[0] || 'A'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-bold text-[#FAFAFA] truncate">{msg.senderName}</p>
                                            {msg.hasMessages && (
                                                <span className="w-2 h-2 rounded-full bg-[#E3C567] flex-shrink-0"></span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#666] truncate mb-1">{msg.dealTitle}</p>
                                        <p className="text-xs text-[#808080] truncate italic">{msg.preview}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <p className="text-sm text-[#666]">No active conversations</p>
                            <p className="text-xs text-[#444] mt-1">Lock in an agent to start chatting</p>
                        </div>
                    )}
                </div>
                )}
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

                {isLoading || agentsLoading ? (
                    <div className="flex-grow space-y-3">
                      {[1,2,3].map(i => (
                        <div key={i} className="h-16 bg-[#141414] rounded-xl animate-pulse"></div>
                      ))}
                    </div>
                ) : suggestedAgents.length > 0 ? (
                    <div className="flex-grow space-y-3">
                        {suggestedAgents.map(agent => {
                            if (!agent) return null;
                            return (
                                <div key={agent.id || Math.random()} className="p-3 bg-[#141414] rounded-xl border border-[#1F1F1F] hover:border-[#E3C567] cursor-pointer transition-colors"
                                     onClick={() => {
                                         if (agent.id) {
                                             let url = `AgentProfile?id=${agent.id}`;
                                             if (orphanDeal?.id) {
                                                 url += `&dealId=${orphanDeal.deal_id || orphanDeal.id}`;
                                             }
                                             navigate(createPageUrl(url));
                                         }
                                     }}>
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
                             ? `No agents found in ${orphanDeal.county ? `${orphanDeal.county}, ${orphanDeal.state}` : orphanDeal.state || 'this area'} yet.` 
                             : 'No recommended agents right now.'}
                        </p>
                        {orphanDeal ? (
                            <>
                                <p className="text-xs text-[#444] mb-4 max-w-[200px]">
                                    {orphanDeal.county 
                                      ? 'We only show agents verified in your deal territory.'
                                      : 'Add county in Deal Wizard for better matches.'}
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567] hover:text-black rounded-full text-xs h-8 mb-2"
                                    onClick={() => setShowAllAgents(true)}
                                >
                                    Show Agents from Other Areas
                                </Button>
                            </>
                        ) : (
                            <p className="text-xs text-[#444] mb-4 max-w-[220px]">
                                Upload a new contract to get matched with agents for your next deal.
                            </p>
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

export default function DashboardInvestor() {
  return (
    <AuthGuard requireAuth={true}>
      <ErrorBoundary>
        <InvestorDashboardContent />
      </ErrorBoundary>
    </AuthGuard>
  );
}