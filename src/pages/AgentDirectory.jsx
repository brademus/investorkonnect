import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { demoAgents, demoRooms } from "@/components/data/demoData";
import { createDealRoom } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, Shield, MapPin, Building, TrendingUp, Award,
  Loader2, Search, Filter, CheckCircle, Clock, MessageCircle
} from "lucide-react";
import { toast } from "sonner";

/**
 * AGENT DIRECTORY - For Investors
 * 
 * Shows ALL agents who have signed up, regardless of onboarding status
 * Requires: investor role + onboarding + KYC + NDA
 */
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
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "Agent Directory - AgentVault";
    
    if (!profileLoading) {
      checkAccessAndLoad();
    }
  }, [profileLoading]);

  const checkAccessAndLoad = async () => {
    // Not logged in
    if (!user) {
      toast.info("Please sign in to browse agents");
      base44.auth.redirectToLogin(createPageUrl("PostAuth"));
      return;
    }

    // Not an investor
    if (role !== 'investor') {
      toast.error("Only investors can browse agents");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }

    // Not onboarded
    if (!onboarded) {
      toast.info("Complete onboarding to access agent directory");
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      return;
    }

    // Check both KYC flag and status field
    const isKycVerified = kycVerified || profile?.kyc_status === 'approved' || profile?.identity_verified || profile?.persona_verified;
    
    if (!isKycVerified) {
      toast.info("Verify your identity to access agent profiles");
      navigate(createPageUrl("Verify"), { replace: true });
      return;
    }

    // Check both NDA flags
    const hasAcceptedNDA = hasNDA || profile?.nda_accepted || profile?.has_accepted_nda;
    
    if (!hasAcceptedNDA) {
      toast.info("Accept NDA to access agent profiles");
      navigate(createPageUrl("NDA"), { replace: true });
      return;
    }

    // Load agents
    await loadAgents();
  };

  const loadAgents = async () => {
    try {
      // DEMO MODE: Use static demo data
      if (DEMO_MODE && DEMO_CONFIG.useStaticData) {
        setAgents(demoAgents);
        setLoading(false);
        return;
      }
      
      const allProfiles = await base44.entities.Profile.filter({});
      
      const agentProfiles = allProfiles.filter(p => 
        p.user_role === 'agent' || p.user_type === 'agent'
      );
      
      setAgents(agentProfiles);
      setLoading(false);
    } catch (error) {
      // Fallback to demo data on error
      if (DEMO_MODE) {
        setAgents(demoAgents);
      } else {
        toast.error("Failed to load agents");
        setAgents([]);
      }
      setLoading(false);
    }
  };

  const handleOpenRoom = async (agent) => {
    if (DEMO_MODE) {
      // Check for existing room with this agent
      const sessionRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
      const allRooms = [...demoRooms, ...sessionRooms];
      const existingRoom = allRooms.find(r => r.counterparty_profile_id === agent.id);
      
      if (existingRoom) {
        navigate(`${createPageUrl("Room")}?roomId=${existingRoom.id}`);
      } else {
        // Create new demo room
        const newRoom = {
          id: 'room-demo-' + Date.now(),
          investorId: 'investor-demo',
          agentId: agent.id,
          counterparty_name: agent.full_name,
          counterparty_role: 'agent',
          counterparty_profile_id: agent.id,
          status: 'active',
          created_date: new Date().toISOString(),
          ndaAcceptedInvestor: true,
          ndaAcceptedAgent: true,
        };
        
        sessionRooms.push(newRoom);
        sessionStorage.setItem('demo_rooms', JSON.stringify(sessionRooms));
        
        toast.success(`Deal room created with ${agent.full_name}`);
        navigate(`${createPageUrl("Room")}?roomId=${newRoom.id}`);
      }
      return;
    }
    
    // Real room creation
    try {
      const response = await createDealRoom({
        counterparty_profile_id: agent.id
      });
      
      if (response.data?.room?.id) {
        toast.success(`Deal room created with ${agent.full_name}`);
        navigate(`${createPageUrl("Room")}?roomId=${response.data.room.id}`);
      } else {
        toast.error("Could not create room");
      }
    } catch (error) {
      toast.error("Failed to create room");
    }
  };

  const filteredAgents = agents.filter(agent => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const name = agent.full_name?.toLowerCase() || '';
    const markets = agent.agent?.markets?.join(' ').toLowerCase() || '';
    const brokerage = agent.agent?.brokerage?.toLowerCase() || '';
    
    return name.includes(search) || markets.includes(search) || brokerage.includes(search);
  });

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading agent directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Agent Directory
          </h1>
          <p className="text-slate-600">
            Browse {agents.length} verified agents in your target market
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by name, market, or brokerage..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </div>

        {/* Agents Grid */}
        {filteredAgents.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {searchTerm ? 'No Agents Match Your Search' : 'No Agents Yet'}
            </h3>
            <p className="text-slate-600 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Be the first to connect with agents when they join'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => {
              const agentData = agent.agent || {};
              const isFullyOnboarded = agent.onboarding_completed_at && agent.onboarding_version;
              const isVerified = agent.kyc_status === 'approved';
              const badges = [];
              
              if (isVerified) badges.push('Verified');
              if (agentData.investor_friendly) badges.push('Investor-friendly');
              if (agentData.personally_invests) badges.push('Personal investor');
              if (agentData.sources_off_market) badges.push('Off-market deals');
              
              return (
                <div
                  key={agent.id}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg mb-1">
                        {agent.full_name || agent.email || 'Agent'}
                      </h3>
                      {agentData.brokerage && (
                        <p className="text-sm text-slate-600">{agentData.brokerage}</p>
                      )}
                    </div>
                    {(isVerified || agent.verified) ? (
                      <Shield className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Status Badge */}
                  {!isFullyOnboarded && !agent.verified && (
                    <Badge variant="outline" className="mb-3 border-amber-300 text-amber-700">
                      <Clock className="w-3 h-3 mr-1" />
                      Profile In Progress
                    </Badge>
                  )}
                  
                  {(isFullyOnboarded && isVerified) || agent.verified ? (
                    <Badge className="mb-3 bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Fully Verified
                    </Badge>
                  ) : null}

                  {/* Markets */}
                  {agentData.markets && agentData.markets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {agentData.markets.slice(0, 3).map((market, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          <MapPin className="w-3 h-3" />
                          {market}
                        </Badge>
                      ))}
                      {agentData.markets.length > 3 && (
                        <Badge variant="secondary">
                          +{agentData.markets.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Bio */}
                  {agentData.bio && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{agentData.bio}</p>
                  )}

                  {/* Experience */}
                  <div className="space-y-2 text-sm mb-4">
                    {agentData.experience_years && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>{agentData.experience_years} years experience</span>
                      </div>
                    )}
                    
                    {(agentData.investor_clients_count || agentData.deals_closed) && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-4 h-4" />
                        <span>{agentData.deals_closed || agentData.investor_clients_count}+ deals closed</span>
                      </div>
                    )}

                    {!agentData.experience_years && !agentData.investor_clients_count && !agentData.deals_closed && (
                      <p className="text-slate-400 text-xs italic">
                        Profile details pending completion
                      </p>
                    )}
                  </div>

                  {/* Specialties */}
                  {(agentData.specialties || agentData.investment_strategies) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(agentData.specialties || agentData.investment_strategies || []).slice(0, 3).map((spec, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Open Deal Room Button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRoom(agent);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Open Deal Room
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}