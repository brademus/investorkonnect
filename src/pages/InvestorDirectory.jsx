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
  Loader2, Search, Filter, CheckCircle, Home as HomeIcon, User, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

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
  const [locationFilter, setLocationFilter] = useState("all");
  const [strategyFilter, setStrategyFilter] = useState("all");

  useEffect(() => {
    document.title = "Find Investors - Investor Konnect";
    if (!profileLoading) checkAccessAndLoad();
  }, [profileLoading]);

  const checkAccessAndLoad = async () => {
    if (!user) {
      toast.info("Please sign in to browse investors");
      base44.auth.redirectToLogin(createPageUrl("PostAuth"));
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
    // DEMO MODE: Skip verification check - users can access directory without KYC
    // if (!kycVerified) {
    //   toast.info("Verify your identity to access investor profiles");
    //   navigate(createPageUrl("Verify"), { replace: true });
    //   return;
    // }
    // DEMO MODE: NDA not required to access directories - optional from dashboard only
    // if (!hasNDA) {
    //   toast.info("Accept NDA to access investor profiles");
    //   navigate(createPageUrl("NDA"), { replace: true });
    //   return;
    // }
    await loadInvestors();
  };

  const loadInvestors = async () => {
    try {
      // Always try to load real investors first
      const allProfiles = await base44.entities.Profile.filter({});
      const realInvestors = allProfiles.filter(p => p.user_role === 'investor' || p.user_type === 'investor');
      
      // Merge with demo investors (avoid duplicates by ID)
      const realIds = new Set(realInvestors.map(i => String(i.id)));
      const demosToShow = demoInvestors.filter(i => !realIds.has(String(i.id)));
      const combined = [...realInvestors, ...demosToShow];
      
      setInvestors(combined);
      setLoading(false);
    } catch (error) {
      console.error("Error loading investors:", error);
      // Fallback to demo investors only
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
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-10 mb-12">
        {/* Page Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            Find investors in your market
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
            Connect with verified investors looking for agents to help them find their next deal.
          </p>
        </header>

        {/* Search & Filter Card */}
        <section className="mb-6 sm:mb-8">
          <div className="ik-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:gap-3">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, location, or strategy..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
                <Select defaultValue="recommended">
                  <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-xl border-gray-200 bg-white text-sm">
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
              <div className="flex flex-wrap items-center gap-3">
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="min-w-[160px] h-11 rounded-xl border-gray-200 bg-white text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="All Locations" />
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
                  <SelectTrigger className="min-w-[160px] h-11 rounded-xl border-gray-200 bg-white text-sm">
                    <TrendingUp className="w-4 h-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="All Strategies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Strategies</SelectItem>
                    <SelectItem value="fix-and-flip">Fix and Flip</SelectItem>
                    <SelectItem value="buy-and-hold">Buy and Hold</SelectItem>
                    <SelectItem value="brrrr">BRRRR</SelectItem>
                    <SelectItem value="value-add">Value-Add</SelectItem>
                  </SelectContent>
                </Select>
                
                <button className="ik-btn-outline h-11 gap-2">
                  <Filter className="w-4 h-4" />
                  More filters
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{filteredInvestors.length}</span> verified investors
          </p>
          {(searchTerm || locationFilter !== "all" || strategyFilter !== "all") && (
            <button 
              onClick={clearFilters}
              className="text-sm text-[#D3A029] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Investor Cards Grid */}
        <section>
          {filteredInvestors.length === 0 ? (
            <div className="ik-card flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF3C7] mb-5">
                <Search className="w-8 h-8 text-[#D3A029]" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                No investors match your filters
              </h2>
              <p className="mt-2 max-w-md text-sm sm:text-base text-gray-600">
                Try adjusting your location, strategy, or other filters to see more investors.
              </p>
              <button
                onClick={clearFilters}
                className="mt-6 ik-btn-outline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInvestors.map((investor) => {
                const investorData = investor.investor || {};
                const metadata = investor.metadata || {};
                const isVerified = investor.kyc_status === 'approved' || investor.verified;
                const isDemo = String(investor.id).startsWith('demo-');
                const deals = investorData.deals_closed_24mo || metadata.experience_years || 5;
                const capital = investorData.capital_available_12mo || "$250K-$500K";
                const strategy = investorData.primary_strategy || metadata.strategies?.[0] || 'Buy & Hold';
                const initials = (investor.full_name || 'I').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                
                return (
                  <div
                    key={investor.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden"
                  >
                    {/* Header Band */}
                    <div className="h-20 bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0]" />
                    
                    {/* Content */}
                    <div className="p-5 -mt-8 flex flex-col flex-1">
                      {/* Avatar + Info */}
                      <div className="flex items-start gap-4">
                        <div className="relative flex-shrink-0">
                          <div className="h-14 w-14 rounded-full bg-[#D1FAE5] flex items-center justify-center text-base font-semibold text-[#059669] ring-4 ring-white shadow-lg">
                            {initials}
                          </div>
                          {isVerified && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                              <CheckCircle className="w-4 h-4 text-[#10B981]" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pt-2">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-gray-900 truncate">
                              {investor.full_name || 'Investor'}
                            </h2>
                            {isDemo && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {investor.markets?.[0] || investor.target_state || 'Location TBD'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Strategy */}
                      <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                        {strategy}
                      </p>
                      
                      {/* Stats */}
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{capital}</div>
                          <div className="text-xs text-gray-500">Budget</div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{metadata.experience_years || 3}+ yrs</div>
                          <div className="text-xs text-gray-500">Experience</div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3">
                        <Link
                          to={`${createPageUrl("InvestorProfile")}?id=${investor.id}`}
                          className="ik-btn-outline flex-1 justify-center gap-1.5"
                        >
                          View Profile
                        </Link>
                        <button
                          onClick={() => handleOpenRoom(investor)}
                          className="ik-btn-primary flex-1 justify-center gap-1.5"
                        >
                          Connect
                        </button>
                      </div>
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