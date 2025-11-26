import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { demoInvestors, demoRooms } from "@/components/data/demoData";
import { createDealRoom } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, TrendingUp, MapPin, Building, DollarSign,
  Loader2, AlertCircle, Shield, Search, Filter, CheckCircle, Clock, MessageCircle
} from "lucide-react";
import { toast } from "sonner";

/**
 * INVESTOR DIRECTORY - For Agents
 * 
 * Shows ALL investors who have signed up, regardless of onboarding status
 * Requires: agent role + onboarding + KYC + NDA
 */
export default function InvestorDirectory() {
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
  
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    document.title = "Investor Directory - Investor Konnect";
    
    if (!profileLoading) {
      checkAccessAndLoad();
    }
  }, [profileLoading]);

  const checkAccessAndLoad = async () => {
    // Not logged in
    if (!user) {
      toast.info("Please sign in to browse investors");
      base44.auth.redirectToLogin(createPageUrl("PostAuth"));
      return;
    }

    // Not an agent
    if (role !== 'agent') {
      toast.error("Only agents can browse investors");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }

    // Not onboarded
    if (!onboarded) {
      toast.info("Complete onboarding to access investor directory");
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
      return;
    }

    // Not KYC verified
    if (!kycVerified) {
      toast.info("Verify your identity to access investor profiles");
      navigate(createPageUrl("Verify"), { replace: true });
      return;
    }

    // No NDA
    if (!hasNDA) {
      toast.info("Accept NDA to access investor profiles");
      navigate(createPageUrl("NDA"), { replace: true });
      return;
    }

    // Load investors
    await loadInvestors();
  };

  const loadInvestors = async () => {
    try {
      // DEMO MODE: Use static demo data
      if (DEMO_MODE && DEMO_CONFIG.useStaticData) {
        setInvestors(demoInvestors);
        setLoading(false);
        return;
      }
      
      const allProfiles = await base44.entities.Profile.filter({});
      
      const investorProfiles = allProfiles.filter(p => 
        p.user_role === 'investor' || p.user_type === 'investor'
      );
      
      setInvestors(investorProfiles);
      setLoading(false);
    } catch (error) {
      // Fallback to demo data on error
      if (DEMO_MODE) {
        setInvestors(demoInvestors);
      } else {
        toast.error("Failed to load investors");
        setInvestors([]);
      }
      setLoading(false);
    }
  };

  const handleOpenRoom = async (investor) => {
    if (DEMO_MODE) {
      // Check for existing room with this investor
      const sessionRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
      const allRooms = [...demoRooms, ...sessionRooms];
      const existingRoom = allRooms.find(r => r.counterparty_profile_id === investor.id);
      
      if (existingRoom) {
        navigate(`${createPageUrl("Room")}?roomId=${existingRoom.id}`);
      } else {
        // Create new demo room
        const newRoom = {
          id: 'room-demo-' + Date.now(),
          investorId: investor.id,
          agentId: 'agent-demo',
          counterparty_name: investor.full_name,
          counterparty_role: 'investor',
          counterparty_profile_id: investor.id,
          status: 'active',
          created_date: new Date().toISOString(),
          ndaAcceptedInvestor: true,
          ndaAcceptedAgent: true,
        };
        
        sessionRooms.push(newRoom);
        sessionStorage.setItem('demo_rooms', JSON.stringify(sessionRooms));
        
        toast.success(`Deal room created with ${investor.full_name}`);
        navigate(`${createPageUrl("Room")}?roomId=${newRoom.id}`);
      }
      return;
    }
    
    // Real room creation
    try {
      const response = await createDealRoom({
        counterparty_profile_id: investor.id
      });
      
      if (response.data?.room?.id) {
        toast.success(`Deal room created with ${investor.full_name}`);
        navigate(`${createPageUrl("Room")}?roomId=${response.data.room.id}`);
      } else {
        toast.error("Could not create room");
      }
    } catch (error) {
      toast.error("Failed to create room");
    }
  };

  const filteredInvestors = investors.filter(investor => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const name = investor.full_name?.toLowerCase() || '';
    const markets = investor.markets?.join(' ').toLowerCase() || '';
    const state = investor.target_state?.toLowerCase() || '';
    
    return name.includes(search) || markets.includes(search) || state.includes(search);
  });

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading investor directory...</p>
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
            Investor Directory
          </h1>
          <p className="text-slate-600">
            Browse {investors.length} verified investors looking for agents in your market
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8 shadow-sm">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by name or market..."
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

        {/* Investors Grid */}
        {filteredInvestors.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {searchTerm ? 'No Investors Match Your Search' : 'No Investors Yet'}
            </h3>
            <p className="text-slate-600 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Be the first to connect with investors when they join'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvestors.map((investor) => {
              const metadata = investor.metadata || {};
              const basic = metadata.basicProfile || {};
              const markets = metadata.targetMarkets || {};
              const strategy = metadata.strategyDeals || {};
              const isFullyOnboarded = investor.onboarding_completed_at && investor.onboarding_version;
              const isVerified = investor.kyc_status === 'approved';
              
              const investorData = investor.investor || {};
              
              return (
                <div
                  key={investor.id}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 text-lg mb-1">
                        {investor.full_name || investor.email || 'Investor'}
                      </h3>
                      {(investorData.company_name || basic.investor_description) && (
                        <p className="text-sm text-slate-600">{investorData.company_name || basic.investor_description}</p>
                      )}
                    </div>
                    {(isVerified || investor.verified) ? (
                      <Shield className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Status Badge */}
                  {!isFullyOnboarded && !investor.verified && (
                    <Badge variant="outline" className="mb-3 border-amber-300 text-amber-700">
                      <Clock className="w-3 h-3 mr-1" />
                      Profile In Progress
                    </Badge>
                  )}
                  
                  {(isFullyOnboarded && isVerified) || investor.verified ? (
                    <Badge className="mb-3 bg-emerald-100 text-emerald-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Fully Verified
                    </Badge>
                  ) : null}

                  {/* Target Market */}
                  {(investor.target_state || investor.markets?.[0]) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(investor.markets || [investor.target_state]).slice(0, 3).map((market, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          <MapPin className="w-3 h-3" />
                          {market}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Key Info */}
                  <div className="space-y-2 text-sm mb-4">
                    {(investorData.typical_deal_size || basic.typical_deal_size) && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <DollarSign className="w-4 h-4" />
                        <span>Typical deal: {investorData.typical_deal_size || basic.typical_deal_size}</span>
                      </div>
                    )}
                    
                    {(investorData.primary_strategy || strategy.primary_strategy) && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>{investorData.primary_strategy || strategy.primary_strategy}</span>
                      </div>
                    )}

                    {(investorData.capital_available_12mo) && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Building className="w-4 h-4" />
                        <span>Capital: {investorData.capital_available_12mo}</span>
                      </div>
                    )}

                    {!basic.typical_deal_size && !strategy.primary_strategy && !investorData.typical_deal_size && (
                      <p className="text-slate-400 text-xs italic">
                        Profile details pending completion
                      </p>
                    )}
                  </div>

                  {/* Strategies */}
                  {(metadata.strategies || strategy.investment_strategies || investorData.property_types) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(metadata.strategies || strategy.investment_strategies || investorData.property_types || []).slice(0, 2).map((strat, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {strat}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Open Deal Room Button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRoom(investor);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
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