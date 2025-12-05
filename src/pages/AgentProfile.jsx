import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { introCreate, ndaStatus, createDealRoom } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NDAModal from "@/components/NDAModal";
import { demoAgents } from "@/components/data/demoData";
import { DEMO_MODE } from "@/components/config/demo";
import { 
  Shield, Star, MapPin, Briefcase, Award,
  CheckCircle, Mail, Loader2, ArrowLeft, MessageCircle
} from "lucide-react";
import { toast } from "sonner";

export default function AgentProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [agentId, setAgentId] = useState(null);

  useEffect(() => {
    // Parse URL params on mount
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    console.log("AgentProfile: URL params id =", id);
    
    if (!id) {
      toast.error("No agent ID provided");
      navigate(createPageUrl("AgentDirectory"));
      return;
    }
    setAgentId(id);
  }, []);

  useEffect(() => {
    if (agentId) {
      console.log("AgentProfile: Loading profile for agentId =", agentId);
      checkNDAAndLoadProfile();
    }
  }, [agentId]);

  const checkNDAAndLoadProfile = async () => {
    try {
      console.log("checkNDAAndLoadProfile called, agentId:", agentId);
      
      // Check if this is a demo agent - if so, skip NDA check and load directly
      const isDemo = String(agentId).startsWith('demo-');
      if (isDemo) {
        console.log("Demo agent detected, loading directly");
        setNdaAccepted(true);
        await loadProfile();
        return;
      }
      
      // Check if authenticated
      const isAuth = await base44.auth.isAuthenticated();
      
      // Only redirect to login if not authenticated
      if (!isAuth) {
        toast.info("Please sign in to view agent profiles");
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      // Check NDA status for real profiles
      try {
        const response = await ndaStatus();
        const data = response.data;

        if (!data.nda?.accepted) {
          setShowNDAModal(true);
          setLoading(false);
          return;
        }
      } catch (ndaErr) {
        console.log("NDA check failed, proceeding anyway:", ndaErr);
      }

      setNdaAccepted(true);
      await loadProfile();
    } catch (error) {
      console.error('Profile load error:', error);
      // Try to load demo profile even on error
      const isDemo = String(agentId).startsWith('demo-');
      if (isDemo) {
        const demoAgent = demoAgents.find(a => String(a.id) === String(agentId));
        if (demoAgent) {
          setProfile(demoAgent);
          setReviews([]);
          setLoading(false);
          return;
        }
      }
      toast.error("Failed to load profile");
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      console.log("loadProfile called with agentId:", agentId);
      
      // Check if this is a demo agent first
      const isDemo = String(agentId).startsWith('demo-');
      console.log("Is demo agent:", isDemo);
      
      if (isDemo) {
        console.log("Looking for demo agent in demoAgents array:", demoAgents.map(a => a.id));
        const demoAgent = demoAgents.find(a => String(a.id) === String(agentId));
        console.log("Found demo agent:", demoAgent?.full_name);
        if (demoAgent) {
          setProfile(demoAgent);
          setReviews([]);
          setLoading(false);
          return;
        }
      }

      // Get real agent profile - try multiple approaches
      let agentProfile = null;
      
      // First try filtering by id
      try {
        const profiles = await base44.entities.Profile.filter({ id: agentId });
        console.log("Profiles found by id filter:", profiles.length);
        if (profiles.length > 0) {
          agentProfile = profiles[0];
        }
      } catch (err) {
        console.log("Filter by id failed, trying list approach");
      }
      
      // If not found, try listing all and finding
      if (!agentProfile) {
        try {
          const allProfiles = await base44.entities.Profile.filter({});
          agentProfile = allProfiles.find(p => String(p.id) === String(agentId));
          console.log("Found via list approach:", !!agentProfile);
        } catch (err) {
          console.log("List approach failed too");
        }
      }
      
      if (!agentProfile) {
        // Try demo fallback
        console.log("No real profile found, trying demo fallback");
        const demoAgent = demoAgents.find(a => String(a.id) === String(agentId));
        if (demoAgent) {
          console.log("Using demo agent fallback:", demoAgent.full_name);
          setProfile(demoAgent);
          setReviews([]);
          setLoading(false);
          return;
        }
        console.log("No demo agent found either");
        toast.error("Agent not found");
        navigate(createPageUrl("AgentDirectory"));
        return;
      }

      // Verify this is an agent profile
      if (agentProfile.user_role !== 'agent' && agentProfile.user_type !== 'agent') {
        toast.error("Profile not found");
        navigate(createPageUrl("AgentDirectory"));
        return;
      }

      setProfile(agentProfile);

      // Load reviews for this agent
      try {
        const agentReviews = await base44.entities.Review.filter({
          reviewee_profile_id: agentId,
          verified: true,
          moderation_status: "approved"
        }, '-created_date');
        setReviews(agentReviews);
      } catch (err) {
        console.warn('Could not load reviews:', err);
        setReviews([]);
      }
      
      setLoading(false);

    } catch (error) {
      console.error('Profile load error:', error);
      // Try demo fallback on error
      const demoAgent = demoAgents.find(a => String(a.id) === String(agentId));
      if (demoAgent) {
        console.log("Error occurred, using demo fallback:", demoAgent.full_name);
        setProfile(demoAgent);
        setReviews([]);
        setLoading(false);
        return;
      }
      toast.error("Failed to load profile");
      setLoading(false);
    }
  };

  const handleNDAAccepted = () => {
    setShowNDAModal(false);
    setNdaAccepted(true);
    loadProfile();
  };

  const handleConnect = async () => {
    const isDemo = String(profile.id).startsWith('demo-');
    
    if (DEMO_MODE || isDemo) {
      // Demo mode - create a demo room
      const sessionRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
      const existingRoom = sessionRooms.find(r => r.counterparty_profile_id === profile.id);
      if (existingRoom) {
        navigate(`${createPageUrl("Room")}?roomId=${existingRoom.id}`);
        return;
      }
      const newRoom = {
        id: 'room-demo-' + Date.now(),
        investorId: 'investor-demo',
        agentId: profile.id,
        counterparty_name: profile.full_name,
        counterparty_role: 'agent',
        counterparty_profile_id: profile.id,
        status: 'active',
        created_date: new Date().toISOString(),
        ndaAcceptedInvestor: true,
        ndaAcceptedAgent: true,
      };
      sessionRooms.push(newRoom);
      sessionStorage.setItem('demo_rooms', JSON.stringify(sessionRooms));
      toast.success(`Deal room created with ${profile.full_name}`);
      navigate(`${createPageUrl("Room")}?roomId=${newRoom.id}`);
      return;
    }
    
    try {
      const response = await createDealRoom({ counterparty_profile_id: profile.id });
      if (response.data?.room?.id) {
        toast.success(`Deal room created with ${profile.full_name}`);
        navigate(`${createPageUrl("Room")}?roomId=${response.data.room.id}`);
      } else {
        toast.error("Could not create room");
      }
    } catch (error) {
      console.error('Connect error:', error);
      toast.error("Failed to create deal room");
    }
  };

  const renderStars = (rating) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${i < rating ? "fill-[#D3A029] text-[#D3A029]" : "text-gray-300"}`}
      />
    ));
  };

  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading agent profile...</p>
        </div>
      </div>
    );
  }

  if (showNDAModal) {
    return <NDAModal open={showNDAModal} onAccepted={handleNDAAccepted} />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="ik-card p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">The agent profile you're looking for doesn't exist or has been removed.</p>
          <Link to={createPageUrl("AgentDirectory")} className="ik-btn-primary">
            Back to Agent Directory
          </Link>
        </div>
      </div>
    );
  }

  const avgRating = calculateAverageRating();
  const agentData = profile.agent || {};
  const isDemo = String(profile.id).startsWith('demo-');

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          className="ik-btn-outline mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Directory
        </button>

        {/* Profile Header */}
        <div className="ik-card p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-2xl flex items-center justify-center text-[#D3A029] text-4xl font-bold shadow-lg">
                {profile.full_name?.charAt(0) || profile.email?.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900">
                      {profile.full_name || "Agent"}
                    </h1>
                    {isDemo && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                        Demo Profile
                      </span>
                    )}
                  </div>
                  {(profile.vetted || profile.verified) && (
                    <span className="ik-chip ik-chip-success">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified Agent
                    </span>
                  )}
                </div>
                <button 
                  className="ik-btn-primary"
                  onClick={handleConnect}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Connect
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#FFFBEB] rounded-xl p-4 border border-[#FDE68A]">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-[#D3A029] fill-[#D3A029]" />
                    <span className="text-2xl font-bold text-gray-900">
                      {agentData.rating || avgRating || "4.9"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{reviews.length || agentData.investor_clients_count || 0} Reviews</p>
                </div>
                <div className="bg-[#FFFBEB] rounded-xl p-4 border border-[#FDE68A]">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-[#D3A029]" />
                    <span className="text-2xl font-bold text-gray-900">
                      {agentData.deals_closed || agentData.investment_deals_last_12m || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Deals Closed</p>
                </div>
                <div className="bg-[#FFFBEB] rounded-xl p-4 border border-[#FDE68A]">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-2xl font-bold text-gray-900">
                      {agentData.experience_years || 5}+
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Years Experience</p>
                </div>
                <div className="bg-[#FFFBEB] rounded-xl p-4 border border-[#FDE68A]">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="w-4 h-4 text-[#D3A029]" />
                    <span className="text-2xl font-bold text-gray-900">
                      {agentData.investor_clients_count || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Investor Clients</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {(profile.markets?.length > 0 || agentData.markets?.length > 0) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[#D3A029] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Markets</p>
                      <p className="text-gray-600">{(profile.markets || agentData.markets || []).join(", ")}</p>
                    </div>
                  </div>
                )}
                {(profile.broker || agentData.brokerage) && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-[#D3A029] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Brokerage</p>
                      <p className="text-gray-600">{profile.broker || agentData.brokerage}</p>
                    </div>
                  </div>
                )}
                {(agentData.license_number || profile.licenseNumber) && (
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-[#D3A029] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">License</p>
                      <p className="text-gray-600">
                        {agentData.license_number || profile.licenseNumber} ({agentData.license_state || profile.licenseState})
                        {agentData.license_type && <span className="text-gray-400"> • {agentData.license_type}</span>}
                      </p>
                    </div>
                  </div>
                )}
                {agentData.typical_deal_price_range && (
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-[#D3A029] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Typical Deal Size</p>
                      <p className="text-gray-600">{agentData.typical_deal_price_range}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Specialties */}
          {agentData.specialties?.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Specialties</h3>
              <div className="flex flex-wrap gap-2">
                {agentData.specialties.map((specialty, idx) => (
                  <span key={idx} className="ik-chip">{specialty}</span>
                ))}
              </div>
            </div>
          )}

          {/* Investment Strategies */}
          {agentData.investment_strategies?.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Investment Strategies</h3>
              <div className="flex flex-wrap gap-2">
                {agentData.investment_strategies.map((strategy, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-[#D1FAE5] text-[#065F46] rounded-full text-sm font-medium">{strategy}</span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {(profile.bio || agentData.bio) && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
              <p className="text-gray-700 leading-relaxed">{profile.bio || agentData.bio}</p>
            </div>
          )}

          {/* What Sets Them Apart */}
          {agentData.what_sets_you_apart && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What Sets Them Apart</h3>
              <p className="text-gray-700 leading-relaxed">{agentData.what_sets_you_apart}</p>
            </div>
          )}
        </div>

        {/* Experience & Expertise */}
        <div className="ik-card p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Experience & Expertise</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {agentData.investor_experience_years && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Investor Experience</p>
                  <p className="font-semibold text-gray-900">{agentData.investor_experience_years}+ years working with investors</p>
                </div>
              )}
              {agentData.investment_deals_last_12m && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Recent Activity</p>
                  <p className="font-semibold text-gray-900">{agentData.investment_deals_last_12m} investment deals in last 12 months</p>
                </div>
              )}
              {agentData.investor_types_served?.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-2">Investor Types Served</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agentData.investor_types_served.map((type, idx) => (
                      <span key={idx} className="px-2 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700">{type}</span>
                    ))}
                  </div>
                </div>
              )}
              {agentData.metrics_used?.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-2">Investment Metrics Used</p>
                  <div className="flex flex-wrap gap-1.5">
                    {agentData.metrics_used.map((metric, idx) => (
                      <span key={idx} className="px-2 py-1 bg-[#FEF3C7] border border-[#FDE68A] rounded-md text-xs text-[#92400E]">{metric}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {agentData.personally_invests && (
                <div className="p-4 bg-[#D1FAE5] border border-[#A7F3D0] rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-[#065F46]" />
                    <p className="font-semibold text-[#065F46]">Active Investor</p>
                  </div>
                  {agentData.personal_investing_notes && (
                    <p className="text-sm text-[#047857] mt-2">{agentData.personal_investing_notes}</p>
                  )}
                </div>
              )}
              {agentData.sources_off_market && (
                <div className="p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-[#92400E]" />
                    <p className="font-semibold text-[#92400E]">Sources Off-Market Deals</p>
                  </div>
                  {agentData.off_market_methods_notes && (
                    <p className="text-sm text-[#B45309] mt-2">{agentData.off_market_methods_notes}</p>
                  )}
                </div>
              )}
              {agentData.primary_neighborhoods_notes && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Areas of Expertise</p>
                  <p className="text-gray-700">{agentData.primary_neighborhoods_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Case Study */}
          {agentData.case_study_best_deal && (
            <div className="mt-6 p-5 bg-gradient-to-r from-[#FFFBEB] to-white border border-[#FDE68A] rounded-xl">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#D3A029]" />
                Success Story
              </h4>
              <p className="text-gray-700">{agentData.case_study_best_deal}</p>
            </div>
          )}
        </div>

        {/* Working Style & Communication */}
        <div className="ik-card p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Working Style</h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            {agentData.typical_response_time && (
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-sm text-gray-500 mb-1">Response Time</p>
                <p className="font-semibold text-gray-900">{agentData.typical_response_time}</p>
              </div>
            )}
            {agentData.update_frequency && (
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-sm text-gray-500 mb-1">Update Frequency</p>
                <p className="font-semibold text-gray-900">{agentData.update_frequency}</p>
              </div>
            )}
            {agentData.preferred_communication_channels?.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-sm text-gray-500 mb-1">Preferred Contact</p>
                <p className="font-semibold text-gray-900">{agentData.preferred_communication_channels.join(', ')}</p>
              </div>
            )}
          </div>

          {agentData.languages_spoken?.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-2">Languages</p>
              <div className="flex flex-wrap gap-2">
                {agentData.languages_spoken.map((lang, idx) => (
                  <span key={idx} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700">{lang}</span>
                ))}
              </div>
            </div>
          )}

          {/* Professional Network */}
          {agentData.pro_network_types?.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Professional Network</h3>
              <p className="text-sm text-gray-500 mb-3">Can connect you with trusted:</p>
              <div className="flex flex-wrap gap-2">
                {agentData.pro_network_types.map((type, idx) => (
                  <span key={idx} className="px-3 py-1.5 bg-[#E0E7FF] text-[#3730A3] rounded-full text-sm font-medium">{type}</span>
                ))}
              </div>
              {agentData.refer_professionals_notes && (
                <p className="text-sm text-gray-600 mt-3">{agentData.refer_professionals_notes}</p>
              )}
            </div>
          )}
        </div>

        {/* Reviews Section */}
        <div className="ik-card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Verified Reviews ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div 
                  key={review.id} 
                  className="border-b border-gray-100 last:border-0 pb-6 last:pb-0"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">{renderStars(review.rating)}</div>
                        <span className="text-sm font-semibold text-gray-900">
                          {review.rating}.0
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {review.reviewer_name}
                      </p>
                    </div>
                    <span className="ik-chip ik-chip-success text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-2">{review.body}</p>
                  {review.market && (
                    <span className="ik-chip text-xs">
                      {review.market}
                    </span>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(review.created_date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}