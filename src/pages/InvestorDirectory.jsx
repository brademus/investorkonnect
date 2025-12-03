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
import { Header } from "@/components/Header";
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
    // Check if user AND profile exist
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
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back Button */}
          <Link 
            to={createPageUrl("Dashboard")} 
            className="inline-flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#111827]">
                Find Investors
              </h1>
              <p className="mt-2 text-base text-[#6B7280]">
                Connect with verified investors looking for agents to help them find their next deal.
              </p>
            </div>
          </div>

          {/* Search & Filter Card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 mb-6">
            <div className="flex flex-col gap-4">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Search by name, location, or strategy..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-slate-50 pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#D3A029] focus:border-transparent"
                  />
                </div>
                <Select defaultValue="recommended">
                  <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-xl border-gray-200 bg-white text-sm">
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
                  <SelectTrigger className="min-w-[160px] h-12 rounded-xl border-gray-200 bg-white text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-[#9CA3AF]" />
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
                  <SelectTrigger className="min-w-[160px] h-12 rounded-xl border-gray-200 bg-white text-sm">
                    <TrendingUp className="w-4 h-4 mr-2 text-[#9CA3AF]" />
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
                
                <Button variant="outline" className="h-12 rounded-xl gap-2 border-gray-200">
                  <Filter className="w-4 h-4" />
                  More filters
                </Button>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-[#6B7280]">
              Showing <span className="font-medium text-[#111827]">{filteredInvestors.length}</span> verified investors
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
          {filteredInvestors.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-3xl flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 bg-[#FEF3C7] rounded-2xl flex items-center justify-center mb-5">
                <Search className="w-8 h-8 text-[#D3A029]" />
              </div>
              <h2 className="text-xl font-bold text-[#111827]">
                No investors match your filters
              </h2>
              <p className="mt-2 max-w-md text-[#6B7280]">
                Try adjusting your location, strategy, or other filters to see more investors.
              </p>
              <Button
                onClick={clearFilters}
                variant="outline"
                className="mt-6 border-[#D3A029] text-[#D3A029] hover:bg-[#FFFBEB]"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    className="bg-white border border-gray-200 rounded-3xl flex flex-col hover:shadow-lg hover:border-[#D3A029] hover:-translate-y-1 transition-all duration-200 overflow-hidden"
                  >
                    {/* Header Band */}
                    <div className="h-16 bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0]" />
                    
                    {/* Content */}
                    <div className="p-6 -mt-8 flex flex-col flex-1">
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
                            <h2 className="text-lg font-bold text-[#111827] truncate">
                              {investor.full_name || 'Investor'}
                            </h2>
                            {isDemo && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-[#6B7280] flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {investor.markets?.[0] || investor.target_state || 'Location TBD'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Strategy */}
                      <p className="mt-3 text-sm text-[#6B7280] line-clamp-2">
                        {strategy}
                      </p>
                      
                      {/* Stats */}
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl text-center">
                          <div className="text-sm font-semibold text-[#111827]">{capital}</div>
                          <div className="text-xs text-[#6B7280]">Budget</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl text-center">
                          <div className="text-sm font-semibold text-[#111827]">{metadata.experience_years || 3}+ yrs</div>
                          <div className="text-xs text-[#6B7280]">Experience</div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3">
                        <Link
                          to={`${createPageUrl("InvestorProfile")}?id=${investor.id}`}
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full border-gray-200 hover:border-[#D3A029] hover:bg-[#FFFBEB]">
                            View Profile
                          </Button>
                        </Link>
                        <Button
                          onClick={() => handleOpenRoom(investor)}
                          className="flex-1 bg-[#D3A029] hover:bg-[#B8902A] text-white"
                        >
                          Connect
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function InvestorDirectory() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorDirectoryContent />
    </AuthGuard>
  );
}