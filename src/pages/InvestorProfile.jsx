import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { createDealRoom, ndaStatus } from "@/components/functions";
import NDAModal from "@/components/NDAModal";
import { demoInvestors } from "@/components/data/demoData";
import { DEMO_MODE } from "@/components/config/demo";
import { 
  Shield, MapPin, Briefcase, TrendingUp, DollarSign,
  CheckCircle, Loader2, ArrowLeft, MessageCircle, Target
} from "lucide-react";
import { toast } from "sonner";

export default function InvestorProfile() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const investorId = urlParams.get("id");
  
  const [loading, setLoading] = useState(true);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (investorId) {
      checkNDAAndLoadProfile();
    } else {
      toast.error("No investor ID provided");
      navigate(createPageUrl("InvestorDirectory"));
    }
  }, [investorId]);

  const checkNDAAndLoadProfile = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      
      if (!isAuth) {
        toast.info("Please sign in to view investor profiles");
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      // Check NDA status
      try {
        const response = await ndaStatus();
        const data = response.data;

        if (!data.nda?.accepted) {
          setShowNDAModal(true);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("NDA status check failed, continuing...");
      }

      setNdaAccepted(true);
      await loadProfile();
    } catch (error) {
      console.error('Profile load error:', error);
      toast.error("Failed to load profile");
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      // Check if this is a demo investor first
      const isDemo = String(investorId).startsWith('demo-');
      
      if (isDemo) {
        const demoInvestor = demoInvestors.find(i => String(i.id) === String(investorId));
        if (demoInvestor) {
          setProfile(demoInvestor);
          setLoading(false);
          return;
        }
      }

      // Get real investor profile
      const profiles = await base44.entities.Profile.filter({ id: investorId });
      
      if (profiles.length === 0) {
        // Try demo fallback
        const demoInvestor = demoInvestors.find(i => String(i.id) === String(investorId));
        if (demoInvestor) {
          setProfile(demoInvestor);
          setLoading(false);
          return;
        }
        toast.error("Investor not found");
        navigate(createPageUrl("InvestorDirectory"));
        return;
      }

      const investorProfile = profiles[0];
      
      // Verify this is an investor profile
      if (investorProfile.user_role !== 'investor' && investorProfile.user_type !== 'investor') {
        toast.error("Profile not found");
        navigate(createPageUrl("InvestorDirectory"));
        return;
      }

      setProfile(investorProfile);
      setLoading(false);

    } catch (error) {
      console.error('Profile load error:', error);
      // Try demo fallback on error
      const demoInvestor = demoInvestors.find(i => String(i.id) === String(investorId));
      if (demoInvestor) {
        setProfile(demoInvestor);
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
        investorId: profile.id,
        agentId: 'agent-demo',
        counterparty_name: profile.full_name,
        counterparty_role: 'investor',
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#D3A029] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading investor profile...</p>
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
          <p className="text-gray-600 mb-6">The investor profile you're looking for doesn't exist or has been removed.</p>
          <Link to={createPageUrl("InvestorDirectory")} className="ik-btn-primary">
            Back to Investor Directory
          </Link>
        </div>
      </div>
    );
  }

  const investorData = profile.investor || {};
  const metadata = profile.metadata || {};
  const isDemo = String(profile.id).startsWith('demo-');
  const isVerified = profile.kyc_status === 'approved' || profile.verified;

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
              <div className="w-32 h-32 bg-gradient-to-br from-[#D1FAE5] to-[#A7F3D0] rounded-2xl flex items-center justify-center text-[#059669] text-4xl font-bold shadow-lg">
                {profile.full_name?.charAt(0) || profile.email?.charAt(0).toUpperCase()}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900">
                      {profile.full_name || "Investor"}
                    </h1>
                    {isDemo && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                        Demo Profile
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isVerified && (
                      <span className="ik-chip ik-chip-success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified Investor
                      </span>
                    )}
                    {investorData.company_name && (
                      <span className="ik-chip">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {investorData.company_name}
                      </span>
                    )}
                  </div>
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
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#D1FAE5] rounded-xl p-4 border border-[#A7F3D0]">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-[#059669]" />
                    <span className="text-lg font-bold text-gray-900">
                      {investorData.capital_available_12mo || "$250K-$500K"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Budget Range</p>
                </div>
                <div className="bg-[#D1FAE5] rounded-xl p-4 border border-[#A7F3D0]">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-[#059669]" />
                    <span className="text-lg font-bold text-gray-900">
                      {investorData.deals_closed_24mo || metadata.experience_years || "3-5"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{investorData.deals_closed_24mo ? 'Deals (24mo)' : 'Years Exp.'}</p>
                </div>
                <div className="bg-[#D1FAE5] rounded-xl p-4 border border-[#A7F3D0]">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-[#059669]" />
                    <span className="text-lg font-bold text-gray-900">
                      {investorData.investor_type || metadata.experience_level || "Active"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Investor Type</p>
                </div>
              </div>

              {/* Location & Markets */}
              <div className="space-y-3">
                {(profile.markets?.length > 0 || profile.target_state) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[#059669] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Target Markets</p>
                      <p className="text-gray-600">
                        {profile.markets?.join(", ") || profile.target_state}
                      </p>
                    </div>
                  </div>
                )}
                {investorData.primary_strategy && (
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-[#059669] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Primary Strategy</p>
                      <p className="text-gray-600">{investorData.primary_strategy}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
              <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
            </div>
          )}
        </div>

        {/* Buy Box Section */}
        <div className="ik-card p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Investment Criteria
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Asset Types */}
            {(investorData.buy_box?.asset_types || metadata.property_types) && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Target Property Types</h3>
                <div className="flex flex-wrap gap-2">
                  {(investorData.buy_box?.asset_types || metadata.property_types || []).map((type, idx) => (
                    <span key={idx} className="ik-chip">{type}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Strategies */}
            {(investorData.investment_strategies || metadata.strategies) && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Investment Strategies</h3>
                <div className="flex flex-wrap gap-2">
                  {(investorData.investment_strategies || metadata.strategies || []).map((strategy, idx) => (
                    <span key={idx} className="ik-chip">{strategy}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Budget */}
            {(investorData.buy_box?.budget_range || investorData.typical_deal_size) && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Deal Size Range</h3>
                <p className="text-gray-600">
                  {investorData.buy_box?.budget_range || investorData.typical_deal_size}
                </p>
              </div>
            )}

            {/* Risk Tolerance */}
            {metadata.risk_tolerance && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Risk Tolerance</h3>
                <span className={`ik-chip ${
                  metadata.risk_tolerance === 'aggressive' ? 'ik-chip-warning' :
                  metadata.risk_tolerance === 'conservative' ? 'ik-chip-success' : ''
                }`}>
                  {metadata.risk_tolerance.charAt(0).toUpperCase() + metadata.risk_tolerance.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* CTA Card */}
        <div className="ik-card p-8 bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border-[#FDE68A]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Ready to work with {profile.full_name?.split(' ')[0] || 'this investor'}?
            </h2>
            <p className="text-gray-600 mb-6">
              Start a secure deal room to discuss opportunities and share documents.
            </p>
            <button 
              className="ik-btn-primary"
              onClick={handleConnect}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Start Conversation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}