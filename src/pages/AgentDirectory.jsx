import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { createDealRoom } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Shield, MapPin, TrendingUp, Star,
  Loader2, Search, Filter, CheckCircle, MessageCircle, Home as HomeIcon, User, ArrowRight
} from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { toast } from "sonner";

export default function AgentDirectory() {
  const navigate = useNavigate();
  const { 
    user, 
    profile, 
    role, 
    loading: profileLoading,
    onboarded,
    kycVerified,
    hasNDA
  } = useCurrentProfile();
  
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Find Your Perfect Agent Match - Investor Konnect";
  }, []);

  useEffect(() => {
    // Wait for profile to finish loading before doing ANY checks
    if (profileLoading) return;

    // After loading complete, check if user and profile exist
    if (!user || !profile) {
      toast.info("Please sign in to browse agents");
      const returnUrl = window.location.pathname + window.location.search;
      base44.auth.redirectToLogin(returnUrl);
      return;
    }

    // Only investors can access
    if (role !== 'investor' && role !== 'admin') {
      toast.error("Only investors can browse agents");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }

    // If not onboarded, send to onboarding
    if (!onboarded) {
      toast.info("Complete onboarding to access agent directory");
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      return;
    }

    // REQUIRE dealId - no free browsing
    const params = new URLSearchParams(window.location.search);
    const dealId = params.get('dealId');
    
    if (!dealId) {
      toast.info("Please start a deal to find matched agents");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }

    // Load deal data
    const loadDeal = async () => {
      try {
        const deals = await base44.entities.Deal.filter({ id: dealId });
        if (deals.length === 0) {
          toast.error("Deal not found");
          navigate(createPageUrl("Dashboard"), { replace: true });
          return;
        }
        
        const dealData = deals[0];
        setDeal(dealData);
        
        // Set location filter based on deal state
        if (dealData.state) {
          const stateMap = {
            'AZ': 'arizona', 'TX': 'texas', 'FL': 'florida', 'CA': 'california'
          };
          const normalizedState = stateMap[dealData.state] || dealData.state.toLowerCase();
          if (['arizona', 'texas', 'florida', 'california'].includes(normalizedState)) {
            setLocationFilter(normalizedState);
          }
        }
      } catch (error) {
        console.error("Failed to load deal:", error);
        toast.error("Failed to load deal");
        navigate(createPageUrl("Dashboard"), { replace: true });
      }
    };

    loadDeal();
  }, [profileLoading, user, profile, role, onboarded]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      
      // If we have a deal, use matching to get recommended agents
      if (deal) {
        const response = await base44.functions.invoke('matchAgentsForInvestor', {
          state: deal.state,
          county: deal.county,
          dealId: deal.id,
          limit: 20
        });
        
        // Keep full match results (profile, reason, score)
        const matchedAgents = response.data?.results || [];
        setAgents(matchedAgents);
      } else {
        // Fallback: Fetch all agents (wrap in match result format)
        const allAgents = await base44.entities.Profile.filter({ user_role: 'agent' });
        const wrapped = allAgents.map(profile => ({ profile, reason: undefined, score: 0 }));
        setAgents(wrapped);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileLoading && user && profile && (role === 'investor' || role === 'admin') && onboarded && deal) {
      loadAgents();
    }
  }, [profileLoading, user, profile, role, onboarded, deal]);

  const handleOpenRoom = async (agent) => {
    try {
      const params = new URLSearchParams(window.location.search);
      const dealId = params.get('dealId');
      
      const payload = { counterparty_profile_id: agent.id };
      if (dealId) {
        payload.deal_id = dealId;
      }
      
      const response = await createDealRoom(payload);
      if (response.data?.room?.id) {
        const roomId = response.data.room.id;
        
        // Immediately lock in the agent to this deal
        if (dealId) {
          const lockResponse = await base44.functions.invoke('lockInDealAgent', {
            room_id: roomId,
            deal_id: dealId
          });

          if (!lockResponse.data?.success) {
            toast.error("Failed to lock in agent. Please try again.");
            return;
          }
        }

        // Invalidate queries to refresh dashboard/pipeline
        await queryClient.invalidateQueries({ queryKey: ['rooms'] });
        await queryClient.invalidateQueries({ queryKey: ['investorDeals'] });
        await queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });

        toast.success(`${agent.full_name} is now your agent for this deal!`);
        navigate(`${createPageUrl("Room")}?roomId=${roomId}`);
      } else toast.error("Could not create room");
    } catch (error) {
      console.error("Failed to create room:", error);
      toast.error("Failed to create room");
    }
  };

  const filteredAgents = agents.filter(item => {
    const agent = item.profile || item; // Support both formats
    if (!searchTerm && locationFilter === "all" && specialtyFilter === "all") return true;
    const search = searchTerm.toLowerCase();
    const name = agent.full_name?.toLowerCase() || '';
    const markets = agent.agent?.markets?.join(' ').toLowerCase() || '';
    const brokerage = agent.agent?.brokerage?.toLowerCase() || '';
    const specialties = agent.agent?.specialties?.join(' ').toLowerCase() || '';
    const matchesSearch = !searchTerm || name.includes(search) || markets.includes(search) || brokerage.includes(search);
    const matchesLocation = locationFilter === "all" || markets.includes(locationFilter.toLowerCase());
    const matchesSpecialty = specialtyFilter === "all" || specialties.includes(specialtyFilter.toLowerCase());
    return matchesSearch && matchesLocation && matchesSpecialty;
  });

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
          <p className="text-[#A3A3A3]">Loading agent directory...</p>
        </div>
      </div>
    );
  }

  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("all");
    setSpecialtyFilter("all");
  };

  return (
    <div className="min-h-screen bg-transparent py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#FAFAFA]">
            {deal ? `Find Agent for ${deal.property_address || 'Your Deal'}` : 'Agent Directory'}
          </h1>
          <p className="mt-1 text-sm text-[#A3A3A3]">
            {deal && deal.city && deal.state 
              ? `Showing verified agents in ${deal.county || deal.city}, ${deal.state}`
              : 'Browse verified, investor-friendly agents'}
          </p>
        </header>

        {/* Search & Filter Card */}
        <section className="mb-5">
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4">
            <div className="flex flex-col gap-3">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, location, or specialty..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-[#1F1F1F] bg-[#1A1A1A] pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D3A029] focus:border-transparent"
                  />
                </div>
                <Select defaultValue="recommended">
                  <SelectTrigger className="w-full sm:w-[160px] h-10 rounded-lg border-[#1F1F1F] bg-[#0D0D0D] text-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="deals">Most Deals</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filter row */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="h-9 rounded-lg border-[#1F1F1F] bg-[#0D0D0D] text-sm px-3">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="arizona">Arizona</SelectItem>
                    <SelectItem value="texas">Texas</SelectItem>
                    <SelectItem value="florida">Florida</SelectItem>
                    <SelectItem value="california">California</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                  <SelectTrigger className="h-9 rounded-lg border-[#1F1F1F] bg-[#0D0D0D] text-sm px-3">
                    <HomeIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                    <SelectValue placeholder="Specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specialties</SelectItem>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="multifamily">Multifamily</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#A3A3A3]">
            <span className="font-medium text-[#FAFAFA]">{filteredAgents.length}</span> agents
          </p>
          {(searchTerm || locationFilter !== "all" || specialtyFilter !== "all") && (
            <button onClick={clearFilters} className="text-sm text-[#D3A029] hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {/* Agent Cards Grid */}
        <section>
          {filteredAgents.length === 0 ? (
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-[#D3A029]" />
              </div>
              <h2 className="text-base font-semibold text-[#FAFAFA]">No agents match your filters</h2>
              <p className="mt-1 text-sm text-[#A3A3A3]">Try adjusting your filters</p>
              <button onClick={clearFilters} className="mt-4 text-sm text-[#D3A029] hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((item) => {
                const agent = item.profile || item; // Support both formats
                const reason = item.reason; // Match reason from backend
                const agentData = agent.agent || {};
                const isVerified = agent.kyc_status === 'approved' || agent.verified || agent.vetted;
                const isDemo = String(agent.id).startsWith('demo-');
                const rating = agentData.rating || 4.9;
                const deals = agentData.deals_closed || agentData.investor_clients_count || 15;
                const years = agentData.experience_years || 8;
                const initials = (agent.full_name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                
                return (
                  <div
                    key={agent.id}
                    className="bg-[#0D0D0D] rounded-xl border border-[#1F1F1F] p-4 hover:border-[#D3A029] hover:shadow-md transition-all"
                  >
                    {/* Avatar + Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        <div className="h-11 w-11 rounded-full bg-[#FEF3C7] flex items-center justify-center text-sm font-semibold text-[#D3A029]">
                          {initials}
                        </div>
                        {isVerified && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0D0D0D] rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-[#FAFAFA] truncate">
                            {agent.full_name || 'Agent'}
                          </h2>
                          {isDemo && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">Demo</span>
                          )}
                        </div>
                        {reason && (
                          <p className="text-xs text-[#D3A029] mt-0.5 line-clamp-1">
                            {reason}
                          </p>
                        )}
                        <p className="text-xs text-[#A3A3A3] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {agent.markets?.[0] || agentData.markets?.[0] || agent.target_state || 'Location TBD'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Specialties */}
                    {agentData.specialties && agentData.specialties.length > 0 && (
                      <p className="text-xs text-[#A3A3A3] mb-3 line-clamp-1">
                        {agentData.specialties.slice(0, 3).join(' • ')}
                      </p>
                    )}
                    
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-t border-gray-100 text-center">
                      <div>
                        <div className="text-sm font-semibold text-[#FAFAFA]">{deals}</div>
                        <div className="text-[10px] text-[#A3A3A3]">Deals</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#FAFAFA] flex items-center justify-center gap-0.5">
                          {rating}
                          <Star className="w-3 h-3 text-[#D3A029] fill-[#D3A029]" />
                        </div>
                        <div className="text-[10px] text-[#A3A3A3]">Rating</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#FAFAFA]">{years}+</div>
                        <div className="text-[10px] text-[#A3A3A3]">Years</div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          const dealId = params.get('dealId');
                          navigate(`/AgentProfile?id=${agent.id}${dealId ? `&dealId=${dealId}` : ''}`);
                        }}
                        className="flex-1 h-9 text-sm font-medium border border-[#1F1F1F] rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#1A1A1A] transition-colors"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={() => handleOpenRoom(agent)}
                        className="flex-1 h-9 text-sm font-medium bg-[#D3A029] text-white rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#B8902A] transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Connect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}