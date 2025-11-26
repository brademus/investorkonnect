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
  Loader2, Search, Filter, CheckCircle, MessageCircle, Home as HomeIcon, User
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
    if (!profileLoading) checkAccessAndLoad();
  }, [profileLoading]);

  const checkAccessAndLoad = async () => {
    if (!user) {
      toast.info("Please sign in to browse agents");
      base44.auth.redirectToLogin(createPageUrl("PostAuth"));
      return;
    }
    if (role !== 'investor') {
      toast.error("Only investors can browse agents");
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }
    if (!onboarded) {
      toast.info("Complete onboarding to access agent directory");
      navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      return;
    }
    const isKycVerified = kycVerified || profile?.kyc_status === 'approved';
    if (!isKycVerified) {
      toast.info("Verify your identity to access agent profiles");
      navigate(createPageUrl("Verify"), { replace: true });
      return;
    }
    const hasAcceptedNDA = hasNDA || profile?.nda_accepted;
    if (!hasAcceptedNDA) {
      toast.info("Accept NDA to access agent profiles");
      navigate(createPageUrl("NDA"), { replace: true });
      return;
    }
    await loadAgents();
  };

  const loadAgents = async () => {
    try {
      if (DEMO_MODE && DEMO_CONFIG.useStaticData) {
        setAgents(demoAgents);
        setLoading(false);
        return;
      }
      const allProfiles = await base44.entities.Profile.filter({});
      const agentProfiles = allProfiles.filter(p => p.user_role === 'agent' || p.user_type === 'agent');
      setAgents(agentProfiles);
      setLoading(false);
    } catch (error) {
      if (DEMO_MODE) setAgents(demoAgents);
      else {
        toast.error("Failed to load agents");
        setAgents([]);
      }
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto mb-4" />
          <p className="text-[#666666]">Loading agent directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      {/* Navigation Bar */}
      <nav className="h-20 bg-white border-b border-[#E5E5E5] sticky top-0 z-50" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <span className="text-xl font-bold text-black">INVESTOR KONNECT</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("DashboardInvestor")}>
              <Button variant="ghost" className="rounded-full font-medium text-[#333333]">Dashboard</Button>
            </Link>
            <Link to={createPageUrl("MyProfile")}>
              <div className="w-10 h-10 bg-[#E5E5E5] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#D4AF37]/20 transition-colors">
                <User className="w-5 h-5 text-[#666666]" />
              </div>
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <section className="pt-12 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-[36px] font-bold text-black mb-2">Find Your Perfect Agent Match</h1>
          <p className="text-[16px] text-[#666666]">Browse our network of verified, investor-friendly real estate agents</p>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="sticky top-20 z-40 bg-white border-b border-[#E5E5E5] px-4 sm:px-6 lg:px-8" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div className="max-w-7xl mx-auto py-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-[2] min-w-[200px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#999999]" />
              <Input
                placeholder="Search by name, location, or specialty"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 pl-12 rounded-lg border-[#E5E5E5] focus:border-[#D4AF37] focus:ring-[#D4AF37]/20"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="h-12 rounded-lg border-[#E5E5E5]">
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
            </div>
            <div className="flex-1 min-w-[150px]">
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="h-12 rounded-lg border-[#E5E5E5]">
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
            </div>
            <Button variant="outline" className="h-12 px-6 rounded-lg border-[#E5E5E5] gap-2">
              <Filter className="w-4 h-4" />
              More Filters
            </Button>
          </div>
        </div>
      </section>

      {/* Results Header */}
      <section className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <p className="text-[16px] text-[#666666]">Showing {filteredAgents.length} verified agents</p>
          <Select defaultValue="recommended">
            <SelectTrigger className="w-[200px] rounded-lg border-[#E5E5E5]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">Sort by: Recommended</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="deals">Most Deals</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Profile Cards Grid */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          {filteredAgents.length === 0 ? (
            <div className="bg-white rounded-[20px] p-16 text-center border border-[#E5E5E5]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Users className="w-16 h-16 text-[#E5E5E5] mx-auto mb-4" />
              <h3 className="text-[20px] font-bold text-black mb-2">
                {searchTerm ? 'No Agents Match Your Search' : 'No Agents Yet'}
              </h3>
              <p className="text-[#666666]">
                {searchTerm ? 'Try adjusting your search terms' : 'Be the first to connect with agents when they join'}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredAgents.map((agent) => {
                const agentData = agent.agent || {};
                const isVerified = agent.kyc_status === 'approved' || agent.verified;
                const rating = agentData.rating || 4.9;
                const deals = agentData.deals_closed || agentData.investor_clients_count || 15;
                const years = agentData.experience_years || 8;
                
                return (
                  <div
                    key={agent.id}
                    className="bg-white rounded-[20px] overflow-hidden border border-[#E5E5E5] transition-all duration-250 hover:-translate-y-1"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
                  >
                    {/* Header Image Section */}
                    <div className="h-[200px] relative bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5">
                      {/* Profile Photo */}
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                        <div className="w-20 h-20 rounded-full bg-white border-4 border-white flex items-center justify-center" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                          <User className="w-10 h-10 text-[#999999]" />
                        </div>
                        {/* Verified Badge */}
                        {isVerified && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <CheckCircle className="w-5 h-5 text-[#00A699]" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 pt-12">
                      <h3 className="text-[20px] font-bold text-black text-center mb-1">
                        {agent.full_name || 'Agent'}
                      </h3>
                      
                      {/* Location */}
                      <div className="flex items-center justify-center gap-1 text-[14px] text-[#666666] mb-1">
                        <MapPin className="w-4 h-4" />
                        <span>{agentData.markets?.[0] || agent.target_state || 'Location not set'}</span>
                      </div>
                      
                      {/* Specialties */}
                      {agentData.specialties && agentData.specialties.length > 0 && (
                        <p className="text-[14px] text-[#666666] text-center mb-4">
                          {agentData.specialties.slice(0, 2).join(', ')}
                        </p>
                      )}
                      
                      {/* Divider */}
                      <div className="h-px bg-[#E5E5E5] my-4"></div>
                      
                      {/* Stats Row */}
                      <div className="flex items-center justify-center gap-6 mb-4">
                        <div className="text-center">
                          <p className="text-[14px] font-bold text-black">{deals}</p>
                          <p className="text-[12px] text-[#666666]">Deals</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[14px] font-bold text-black flex items-center justify-center gap-1">
                            {rating}<Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
                          </p>
                          <p className="text-[12px] text-[#666666]">Rating</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[14px] font-bold text-black">{years}</p>
                          <p className="text-[12px] text-[#666666]">Years</p>
                        </div>
                      </div>
                      
                      {/* View Profile Button */}
                      <Button
                        onClick={() => handleOpenRoom(agent)}
                        className="w-full h-11 rounded-lg bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold transition-all duration-200"
                      >
                        View Profile
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}