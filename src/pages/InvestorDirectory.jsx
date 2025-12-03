import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { demoInvestors, demoRooms } from "@/components/data/demoData";
import { createDealRoom } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Shield, MapPin, TrendingUp, DollarSign, Star,
  Loader2, Search, Filter, CheckCircle, Home as HomeIcon, User, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/AuthGuard";

function InvestorDirectoryContent() {
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
  const [locationFilter, setLocationFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");

  useEffect(() => {
    document.title = "Find Investors - Investor Konnect";
    if (!profileLoading) checkAccessAndLoad();
  }, [profileLoading]);

  const checkAccessAndLoad = async () => {
    if (!user || !profile) {
      toast.info("Please sign in to browse investors");
      base44.auth.redirectToLogin(createPageUrl("InvestorDirectory"));
      return;
    }
    if (role !== 'agent') {
      toast.error("Only agents can browse investors");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }
    if (!onboarded) {
      toast.info("Complete onboarding to access investor directory");
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
      return;
    }
    await loadInvestors();
  };

  const loadInvestors = async () => {
    try {
      const allProfiles = await base44.entities.Profile.filter({});
      const realInvestors = allProfiles.filter(p => p.user_role === 'investor' || p.user_type === 'investor');
      
      const realIds = new Set(realInvestors.map(i => String(i.id)));
      const demosToShow = demoInvestors.filter(i => !realIds.has(String(i.id)));
      const combined = [...realInvestors, ...demosToShow];
      
      setInvestors(combined);
      setLoading(false);
    } catch (error) {
      console.error("Error loading investors:", error);
      setInvestors(demoInvestors);
      setLoading(false);
    }
  };

  const handleOpenRoom = async (investor) => {
    if (DEMO_MODE) {
      const sessionRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
      const allRooms = [...demoRooms, ...sessionRooms];
      const existingRoom = allRooms.find(r => r.counterparty_profile_id === investor.id);
      if (existingRoom) {
        navigate(`${createPageUrl("Room")}?roomId=${existingRoom.id}`);
      } else {
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
    try {
      const response = await createDealRoom({ counterparty_profile_id: investor.id });
      if (response.data?.room?.id) {
        toast.success(`Deal room created with ${investor.full_name}`);
        navigate(`${createPageUrl("Room")}?roomId=${response.data.room.id}`);
      } else toast.error("Could not create room");
    } catch (error) {
      toast.error("Failed to create room");
    }
  };

  const filteredInvestors = investors.filter(investor => {
    if (!searchTerm && locationFilter === "all" && strategyFilter === "all") return true;
    const search = searchTerm.toLowerCase();
    const name = investor.full_name?.toLowerCase() || '';
    const markets = investor.markets?.join(' ').toLowerCase() || '';
    const state = investor.target_state?.toLowerCase() || '';
    const strategies = investor.investor?.investment_strategies?.join(' ').toLowerCase() || '';
    const matchesSearch = !searchTerm || name.includes(search) || markets.includes(search) || state.includes(search);
    const matchesLocation = locationFilter === "all" || state.includes(locationFilter.toLowerCase()) || markets.includes(locationFilter.toLowerCase());
    const matchesStrategy = strategyFilter === "all" || strategies.includes(strategyFilter.toLowerCase());
    return matchesSearch && matchesLocation && matchesStrategy;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setLocationFilter("all");
    setStrategyFilter("all");
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading investor directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-6 sm:py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#111827]">Investor Directory</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Connect with verified investors looking for agents
          </p>
        </header>

        {/* Search & Filter Card */}
        <section className="mb-5">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-col gap-3">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, location, or strategy..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D3A029] focus:border-transparent"
                  />
                </div>
                <Select defaultValue="recommended">
                  <SelectTrigger className="w-full sm:w-[160px] h-10 rounded-lg border-gray-200 bg-white text-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="capital">Highest Capital</SelectItem>
                    <SelectItem value="deals">Most Deals</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filter row */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="h-9 rounded-lg border-gray-200 bg-white text-sm px-3">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="arizona">Arizona</SelectItem>
                    <SelectItem value="texas">Texas</SelectItem>
                    <SelectItem value="florida">Florida</SelectItem>
                    <SelectItem value="california">California</SelectItem>
                    <SelectItem value="georgia">Georgia</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                  <SelectTrigger className="h-9 rounded-lg border-gray-200 bg-white text-sm px-3">
                    <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                    <SelectValue placeholder="Strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strategies</SelectItem>
                    <SelectItem value="fix-and-flip">Fix and Flip</SelectItem>
                    <SelectItem value="buy-and-hold">Buy and Hold</SelectItem>
                    <SelectItem value="brrrr">BRRRR</SelectItem>
                    <SelectItem value="value-add">Value-Add</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-[#6B7280]">
            <span className="font-medium text-[#111827]">{filteredInvestors.length}</span> investors
          </p>
          {(searchTerm || locationFilter !== "all" || strategyFilter !== "all") && (
            <button onClick={clearFilters} className="text-sm text-[#D3A029] hover:underline">
              Clear filters
            </button>
          )}
        </div>

        {/* Investor Cards Grid */}
        <section>
          {filteredInvestors.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-12 h-12 bg-[#D1FAE5] rounded-xl flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-[#059669]" />
              </div>
              <h2 className="text-base font-semibold text-[#111827]">No investors match your filters</h2>
              <p className="mt-1 text-sm text-[#6B7280]">Try adjusting your filters</p>
              <button onClick={clearFilters} className="mt-4 text-sm text-[#D3A029] hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInvestors.map((investor) => {
                const investorData = investor.investor || {};
                const metadata = investor.metadata || {};
                const isVerified = investor.kyc_status === 'approved' || investor.verified;
                const isDemo = String(investor.id).startsWith('demo-');
                const capital = investorData.capital_available_12mo || "$250K-$500K";
                const strategy = investorData.primary_strategy || metadata.strategies?.[0] || 'Buy & Hold';
                const initials = (investor.full_name || 'I').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                
                return (
                  <div
                    key={investor.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#10B981] hover:shadow-md transition-all"
                  >
                    {/* Avatar + Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        <div className="h-11 w-11 rounded-full bg-[#D1FAE5] flex items-center justify-center text-sm font-semibold text-[#059669]">
                          {initials}
                        </div>
                        {isVerified && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-[#111827] truncate">
                            {investor.full_name || 'Investor'}
                          </h2>
                          {isDemo && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-medium rounded">Demo</span>
                          )}
                        </div>
                        <p className="text-xs text-[#6B7280] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {investor.markets?.[0] || investor.target_state || 'Location TBD'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Strategy */}
                    <p className="text-xs text-[#6B7280] mb-3 line-clamp-1">{strategy}</p>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 py-3 border-t border-gray-100">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-[#111827]">{capital}</div>
                        <div className="text-[10px] text-[#6B7280]">Budget</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-[#111827]">{metadata.experience_years || 3}+ yrs</div>
                        <div className="text-[10px] text-[#6B7280]">Experience</div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <Link
                        to={`${createPageUrl("InvestorProfile")}?id=${investor.id}`}
                        className="flex-1 h-9 text-sm font-medium border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => handleOpenRoom(investor)}
                        className="flex-1 h-9 text-sm font-medium bg-[#10B981] text-white rounded-lg flex items-center justify-center hover:bg-[#059669] transition-colors"
                      >
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

export default function InvestorDirectory() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorDirectoryContent />
    </AuthGuard>
  );
}