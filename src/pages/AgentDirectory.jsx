import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { demoAgents, demoRooms } from "@/components/data/demoData";
import { createDealRoom } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Shield, MapPin, TrendingUp, Star,
  Loader2, Search, Filter, CheckCircle, MessageCircle, Home as HomeIcon, User, ArrowRight
} from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  useEffect(() => {
    document.title = "Find Your Perfect Agent Match - Investor Konnect";
  }, []);

  useEffect(() => {
    // Only run access checks after profile is done loading
    if (profileLoading) return;
    
    // If no user after loading complete, redirect to login
    if (!user) {
      toast.info("Please sign in to browse agents");
      base44.auth.redirectToLogin(createPageUrl("AgentDirectory"));
      return;
    }
    
    // Only investors can access
    if (role && role !== 'investor' && role !== 'admin') {
      toast.error("Only investors can browse agents");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }
    
    // If not onboarded, send to onboarding
    if (!onboarded && role === 'investor') {
      toast.info("Complete onboarding to access agent directory");
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      return;
    }
    
    // All checks passed, load agents
    loadAgents();
  }, [profileLoading, user, role, onboarded]);

  const loadAgents = async () => {
    try {
      // Always try to load real agents first
      const allProfiles = await base44.entities.Profile.filter({});
      const realAgents = allProfiles.filter(p => p.user_role === 'agent' || p.user_type === 'agent');
      
      // Merge with demo agents (avoid duplicates by ID)
      const realIds = new Set(realAgents.map(a => String(a.id)));
      const demosToShow = demoAgents.filter(a => !realIds.has(String(a.id)));
      const combined = [...realAgents, ...demosToShow];
      
      setAgents(combined);
      setLoading(false);
    } catch (error) {
      console.error("Error loading agents:", error);
      // Fallback to demo agents only
      setAgents(demoAgents);
      setLoading(false);
    }
  };

  const handleOpenRoom = async (agent) => {
    if (DEMO_MODE) {
      const sessionRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
      const allRooms = [...demoRooms, ...sessionRooms];
      const existingRoom = allRooms.find(r => r.counterparty_profile_id === agent.id);
      if (existingRoom) {
        navigate(`${createPageUrl("Room")}?roomId=${existingRoom.id}`);
      } else {
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
    try {
      const response = await createDealRoom({ counterparty_profile_id: agent.id });
      if (response.data?.room?.id) {
        toast.success(`Deal room created with ${agent.full_name}`);
        navigate(`${createPageUrl("Room")}?roomId=${response.data.room.id}`);
      } else toast.error("Could not create room");
    } catch (error) {
      toast.error("Failed to create room");
    }
  };

  const filteredAgents = agents.filter(agent => {
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
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Loading agent directory...</p>
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
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-10 mb-12">
        {/* Page Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#111827]">
            Find your perfect agent match
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#4B5563] max-w-2xl">
            Browse our network of verified, investor-friendly agents and connect with the ones who fit your strategy and market.
          </p>
        </header>

        {/* Search & Filter Card */}
        <section className="mb-6 sm:mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:gap-3">
              {/* Search row */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, location, or specialty..."
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
                    <SelectItem value="rating">Highest Rated</SelectItem>
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
                  </SelectContent>
                </Select>
                
                <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                  <SelectTrigger className="min-w-[160px] h-11 rounded-xl border-gray-200 bg-white text-sm">
                    <HomeIcon className="w-4 h-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="All Specialties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specialties</SelectItem>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="multifamily">Multifamily</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
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
            Showing <span className="font-medium text-gray-900">{filteredAgents.length}</span> verified agents
          </p>
          {(searchTerm || locationFilter !== "all" || specialtyFilter !== "all") && (
            <button 
              onClick={clearFilters}
              className="text-sm text-[#D3A029] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Agent Cards Grid */}
        <section>
          {filteredAgents.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-3xl flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF3C7] mb-5">
                <Search className="w-8 h-8 text-[#D3A029]" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                No agents match your filters
              </h2>
              <p className="mt-2 max-w-md text-sm sm:text-base text-gray-600">
                Try adjusting your location, specialty, or other filters to see more investor-friendly agents.
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
              {filteredAgents.map((agent) => {
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
                    className="bg-white rounded-3xl shadow-sm border border-gray-200 flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden"
                  >
                    {/* Header Band */}
                    <div className="h-20 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A]" />
                    
                    {/* Content */}
                    <div className="p-5 -mt-8 flex flex-col flex-1">
                      {/* Avatar + Info */}
                      <div className="flex items-start gap-4">
                        <div className="relative flex-shrink-0">
                          <div className="h-14 w-14 rounded-full bg-[#FEF3C7] flex items-center justify-center text-base font-semibold text-[#D3A029] ring-4 ring-white shadow-lg">
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
                              {agent.full_name || 'Agent'}
                            </h2>
                            {isDemo && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-gray-600 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {agent.markets?.[0] || agentData.markets?.[0] || agent.target_state || 'Location TBD'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Specialties */}
                      {agentData.specialties && agentData.specialties.length > 0 && (
                        <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                          {agentData.specialties.slice(0, 3).join(' • ')}
                        </p>
                      )}
                      
                      {/* Stats */}
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{deals}</div>
                          <div className="text-xs text-gray-500">Deals</div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 flex items-center justify-center gap-0.5">
                            {rating}
                            <Star className="w-3 h-3 text-[#D3A029] fill-[#D3A029]" />
                          </div>
                          <div className="text-xs text-gray-500">Rating</div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{years}+</div>
                          <div className="text-xs text-gray-500">Years</div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3">
                        <Link
                          to={`${createPageUrl("AgentProfile")}/${agent.id}`}
                          className="ik-btn-outline flex-1 justify-center gap-1.5"
                        >
                          View Profile
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleOpenRoom(agent)}
                          className="ik-btn-primary flex-1 justify-center gap-1.5"
                        >
                          <MessageCircle className="w-4 h-4" />
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