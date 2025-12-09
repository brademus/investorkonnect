import React, { useEffect, useState } from "react";
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
  Loader2, Sparkles, Home, DollarSign, CreditCard, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";

function InvestorDashboardContent() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentMessages, setRecentMessages] = useState([]);
  const [suggestedAgents, setSuggestedAgents] = useState([]);
  const [latestDealState, setLatestDealState] = useState(null);
  const [orphanDeal, setOrphanDeal] = useState(null);
  const [agentsLoading, setAgentsLoading] = useState(false);
  
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  
  const queryClient = useQueryClient();

  // DIRECT DATA FETCHING FOR ROBUSTNESS
  // Fetch active deals for this investor
  const { data: activeDeals, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['investorDeals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      return await base44.entities.Deal.filter(
         { investor_id: profile.id, status: 'active' }, 
         { created_date: -1 }, // Newest first
         10
      );
    },
    enabled: !!profile?.id,
    refetchOnMount: true,
    staleTime: 0 
  });

  useEffect(() => {
    loadProfile();
  }, []);
  
  // Force refetch when returning to dashboard
  useEffect(() => {
    if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        refetchDeals();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!activeDeals || !rooms) return;

    // Logic: An "orphan" deal is an active deal that is NOT linked to any REAL (connected) room yet.
    
    // Get all deal IDs currently in REAL rooms (exclude virtual/orphan rooms that the backend might return)
    // We only want to exclude deals that have actually been matched with an agent.
    const dealIdsInRealRooms = new Set(
      rooms
        .filter(r => !r.is_orphan && r.counterparty_role !== 'none') 
        .map(r => r.deal_id)
        .filter(Boolean)
    );
    
    // Find the most recent active deal that is NOT in a real room
    const orphan = activeDeals.find(d => !dealIdsInRealRooms.has(d.id));
    
    setOrphanDeal(orphan || null);
    
    if (orphan) {
        // We found an orphan deal! Let's load suggestions for it.
        let state = orphan.state;
        
        // Fallback extraction from address if state field is missing
        if (!state && orphan.property_address) {
          const parts = orphan.property_address.split(',');
          if (parts.length > 1) {
             const stateZip = parts[parts.length - 1].trim();
             const possibleState = stateZip.split(' ')[0];
             if (possibleState.length === 2) state = possibleState;
          }
        }
        
        state = state ? state.trim().toUpperCase() : null;
        
        if (state) {
            setLatestDealState(state);
            loadSuggestedAgents(state, orphan.id);
        }
    } else {
        // No orphan deals found
        setSuggestedAgents([]);
        setLatestDealState(null);
    }
    
  }, [activeDeals, rooms]);

  const loadProfile = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) {
        setLoading(false);
        return;
      }
      
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const directProfile = profiles[0];
      
      setProfile(directProfile);
      loadRecentMessages();
      setLoading(false);
    } catch (error) {
      console.error('[DashboardInvestor] Error loading profile:', error);
      setLoading(false);
    }
  };

  const loadRecentMessages = async () => {
    try {
      const response = await inboxList();
      if (response.data) {
        setRecentMessages(response.data.slice(0, 3));
      }
    } catch (err) {
      // Silent fail
    }
  };

  const loadSuggestedAgents = async (state, dealId) => {
    setAgentsLoading(true);
    try {
      console.log("Loading agents for state:", state);
      const response = await base44.functions.invoke('matchAgentsForInvestor', {
        state,
        dealId,
        limit: 3
      });
      
      if (response.data?.results) {
        console.log("Agents found:", response.data.results.length);
        setSuggestedAgents(response.data.results.map(r => r.profile));
      } else {
        console.log("No agents found in response");
        setSuggestedAgents([]);
      }
    } catch (err) {
      console.error("Failed to load suggested agents", err);
      setSuggestedAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  };

  // Calculate deal stats from rooms (same logic as detail pages)
  const dealStats = {
    active: rooms.filter(r => r.pipeline_stage !== 'closing').length,  // All non-closing deals = active
    pending: 0, // Not used - always 0
    closed: rooms.filter(r => r.pipeline_stage === 'closing').length  // Only closing stage = closed
  };

  if (loading || roomsLoading) {
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

  const firstName = profile?.full_name?.split(' ')[0] || 'Investor';

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
                Track deals, connect with agents, and grow your portfolio.
              </p>
            </div>

            {/* Setup Checklist */}
            <SetupChecklist profile={profile} onRefresh={loadProfile} />

            {/* 4-Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
              {/* Box 1: Start New Deal (OR Continue Existing) */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col hover:shadow-xl hover:border-[#E3C567] transition-all">
                {orphanDeal ? (
                  <>
                    {/* ORPHAN DEAL STATE */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center animate-pulse">
                        <FileText className="w-6 h-6 text-[#E3C567]" />
                      </div>
                      <span className="px-3 py-1.5 bg-[#E3C567]/20 text-[#E3C567] text-xs font-medium rounded-full flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E3C567] animate-pulse"></span>
                        Pending Agent
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">Find an Agent</h3>
                    <div className="flex-grow space-y-3">
                      <p className="text-sm text-[#808080]">
                        Select a matching agent from the suggestions to start your deal room.
                      </p>
                      <div className="bg-[#141414] rounded-xl p-3 border border-[#E3C567]/30">
                         <p className="text-[#FAFAFA] font-medium text-sm truncate">{orphanDeal.property_address || orphanDeal.title}</p>
                         <div className="flex items-center gap-2 mt-1 text-xs text-[#808080]">
                            <span>{orphanDeal.city}, {orphanDeal.state}</span>
                            <span>•</span>
                            <span className="text-[#E3C567]">${(orphanDeal.budget || orphanDeal.purchase_price || 0).toLocaleString()}</span>
                         </div>
                      </div>
                    </div>
                    {/* Button removed as requested - user must select from suggested agents */}
                    <div className="mt-4 p-3 bg-[#E3C567]/10 rounded-lg border border-[#E3C567]/20">
                        <p className="text-xs text-[#E3C567] text-center flex items-center justify-center gap-2">
                            <Sparkles className="w-3 h-3" />
                            Use the card below to connect ↘
                        </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* DEFAULT STATE */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                        <Plus className="w-6 h-6 text-[#E3C567]" />
                      </div>
                      <span className="px-3 py-1.5 bg-[#E3C567]/20 text-[#E3C567] text-xs font-medium rounded-full">
                        Primary
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">Start New Deal</h3>
                    <p className="text-sm text-[#808080] mb-6 flex-grow">
                      Submit a deal and get matched with investor-friendly agents.
                    </p>
                    <Button 
                      onClick={() => navigate(createPageUrl("DealWizard"))}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Submit Deal
                    </Button>
                  </>
                )}
              </div>

              {/* Box 2: Deal Pipeline */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E5C37F]/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-[#E5C37F]" />
                  </div>
                  <Link to={createPageUrl("Pipeline")} className="text-xs text-[#E5C37F] hover:underline">
                    View full pipeline →
                  </Link>
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Deal Pipeline</h3>
          
                <div className="space-y-2 flex-grow">
                  <button 
                    onClick={() => navigate(createPageUrl("ActiveDeals"))}
                    className="w-full flex items-center justify-between p-3 bg-[#E5C37F]/10 rounded-lg hover:bg-[#E5C37F]/20 transition-colors border border-[#E5C37F]/20">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-[#E5C37F]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Active</span>
                    </div>
                    <span className="text-lg font-bold text-[#E5C37F]">{dealStats.active}</span>
                  </button>
            
                  <button 
                    onClick={() => navigate(createPageUrl("PendingDeals"))}
                    className="w-full flex items-center justify-between p-3 bg-[#262626] rounded-lg hover:bg-[#333333] transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#808080]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Pending</span>
                    </div>
                    <span className="text-lg font-bold text-[#808080]">{dealStats.pending}</span>
                  </button>
            
                  <button 
                    onClick={() => navigate(createPageUrl("ClosedDeals"))}
                    className="w-full flex items-center justify-between p-3 bg-[#E3C567]/10 rounded-lg hover:bg-[#E3C567]/20 transition-colors border border-[#E3C567]/20">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#E3C567]" />
                      <span className="text-sm font-medium text-[#FAFAFA]">Closed</span>
                    </div>
                    <span className="text-lg font-bold text-[#E3C567]">{dealStats.closed}</span>
                  </button>
                </div>
              </div>

              {/* Box 3: Recent Messages */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  {/* View all link removed */}
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">Messages</h3>
          
                {recentMessages.length > 0 ? (
                  <div className="space-y-2 flex-grow">
                    {recentMessages.map((msg, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-[#1F1F1F] hover:border-[#E5C37F] hover:bg-[#262626] transition-all">
                        <div className="w-8 h-8 bg-[#E5C37F]/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#E5C37F]">
                            {msg.senderName?.charAt(0) || 'A'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#FAFAFA] truncate">{msg.senderName || 'Agent'}</p>
                          <p className="text-xs text-[#808080] truncate">{msg.preview || 'New message'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 flex-grow flex flex-col items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-[#333333] mb-2" />
                    <p className="text-sm text-[#808080]">No messages yet</p>
                    <p className="text-xs text-[#666666]">Start a deal to connect</p>
                  </div>
                )}
              </div>

              {/* Box 4: Suggested Agents */}
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-[#E3C567]" />
                  </div>
                  {/* Browse link hidden if no rooms */}
                  {rooms.length > 0 && (
                    <Link to={createPageUrl("AgentDirectory")} className="text-xs text-[#E5C37F] hover:underline">
                      Browse →
                    </Link>
                  )}
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-4">
                  {latestDealState ? `Agents in ${latestDealState}` : 'Suggested Agents'}
                </h3>
          
                {rooms.length === 0 ? (
                  <div className="text-center py-8 flex-grow flex flex-col items-center justify-center">
                    <Users className="w-8 h-8 text-[#333333] mb-2" />
                    <p className="text-sm text-[#808080] mb-1">No agents found yet</p>
                    <p className="text-xs text-[#666666] max-w-[200px]">
                      Upload a contract to find investor-friendly agents in your market.
                    </p>
                  </div>
                ) : agentsLoading ? (
                  <div className="text-center py-8 flex-grow flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-[#E3C567] animate-spin mb-2" />
                    <p className="text-sm text-[#808080]">Finding best matches...</p>
                  </div>
                ) : suggestedAgents.length > 0 ? (
                  <div className="space-y-3 flex-grow">
                     {suggestedAgents.map(agent => (
                       <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1F1F1F] cursor-pointer transition-colors" onClick={() => navigate(createPageUrl(`AgentProfile?id=${agent.id}`))}>
                         <div className="w-10 h-10 bg-[#E3C567]/20 rounded-full flex items-center justify-center font-bold text-[#E3C567]">
                            {agent.full_name?.charAt(0)}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium text-[#FAFAFA] truncate">{agent.full_name}</p>
                           <p className="text-xs text-[#808080] truncate">{agent.agent?.brokerage || 'Independent'}</p>
                         </div>
                         <div className="text-xs text-[#E3C567] font-medium">
                           {(agent.agent?.experience_years || 0) + 'y'}
                         </div>
                       </div>
                     ))}
                  </div>
                ) : (
                  <div className="text-center py-8 flex-grow flex flex-col items-center justify-center">
                    <Users className="w-8 h-8 text-[#333333] mb-2" />
                    <p className="text-sm text-[#808080]">No direct matches found.</p>
                    <p className="text-xs text-[#666666] mt-1">Try browsing the directory.</p>
                  </div>
                )}
                
                {rooms.length > 0 && (
                  <Button 
                    onClick={() => navigate(createPageUrl(`AgentDirectory${latestDealState ? `?state=${latestDealState}` : ''}`))}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold mt-auto"
                  >
                    Browse All in {latestDealState || 'Market'}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Subscription', icon: CreditCard, href: 'Pricing' },
                { label: 'My Profile', icon: Users, href: 'AccountProfile' },
                { label: 'Documents', icon: FileText, href: 'InvestorDocuments' },
                { label: 'AI Assistant', icon: Bot, href: 'AIAssistant' },
              ].map((link) => {
                const Icon = link.icon;
                return (
                  <Link 
                    key={link.href} 
                    to={createPageUrl(link.href)} 
                    className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl flex items-center gap-2 p-3 hover:border-[#E5C37F] hover:bg-[#141414] transition-all"
                  >
                    <div className="w-8 h-8 bg-[#E5C37F]/20 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#E5C37F]" />
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

export default function DashboardInvestor() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorDashboardContent />
    </AuthGuard>
  );
}