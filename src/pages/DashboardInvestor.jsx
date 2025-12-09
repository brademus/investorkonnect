import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { SetupChecklist } from "@/components/SetupChecklist";
import { base44 } from "@/api/base44Client";
import { inboxList } from "@/components/functions";
import { useRooms } from "@/components/useRooms";
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

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    // Logic: 
    // 1. Find the most recent orphan deal (one without an agent).
    // 2. If found, load agents for that deal's state.
    // 3. If NO orphan deal exists (all deals have agents), clear suggestions.
    
    if (rooms) {
      // Find newest deal that is orphan
      const orphan = rooms.find(r => r.is_orphan);
      setOrphanDeal(orphan);
      
      if (orphan) {
        // Extract state - be robust
        const orphanDeal = orphan; // Alias for readability below
        let state = orphanDeal.state;
        if (!state && orphanDeal.property_address) {
          // Try to extract from address string if state field missing
          // e.g. "123 Main St, City, CA 90210" -> "CA"
          const parts = orphanDeal.property_address.split(',');
          if (parts.length > 1) {
             const stateZip = parts[parts.length - 1].trim();
             state = stateZip.split(' ')[0];
          }
        }
        
        // Clean state
        state = state ? state.trim().toUpperCase() : null;
        
        if (state) { // Allow lengths > 2 just in case, matchAgents handles it
          setLatestDealState(state);
          loadSuggestedAgents(state, orphanDeal.deal_id); // Use real deal_id
        }
      } else {
        // No orphan deals - user has agents for all deals
        setSuggestedAgents([]);
        setLatestDealState(null);
      }
    }
  }, [rooms]);

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
      const response = await base44.functions.invoke('matchAgentsForInvestor', {
        state,
        dealId,
        limit: 3
      });
      
      if (response.data?.results && response.data.results.length > 0) {
        setSuggestedAgents(response.data.results.map(r => r.profile));
        
        // If fallback matches (no agents in that specific state), update UI to reflect that
        if (response.data.match_type === 'fallback') {
           setLatestDealState(null); // Will change title to "Suggested Agents"
        }
      } else {
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
                        Action Required
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">Select an Agent</h3>
                    <div className="flex-grow space-y-3">
                      <p className="text-sm text-[#808080]">
                        You have a deal pending agent selection.
                      </p>
                      <div className="bg-[#141414] rounded-xl p-3 border border-[#1F1F1F]">
                         <p className="text-[#FAFAFA] font-medium text-sm truncate">{orphanDeal.property_address || orphanDeal.title}</p>
                         <div className="flex items-center gap-2 mt-1 text-xs text-[#808080]">
                            <span>{orphanDeal.city}, {orphanDeal.state}</span>
                            <span>•</span>
                            <span className="text-[#E3C567]">${(orphanDeal.budget || 0).toLocaleString()}</span>
                         </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => navigate(`${createPageUrl("DealWizard")}?dealId=${orphanDeal.deal_id}`)}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold mt-4"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Select Agent
                    </Button>
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