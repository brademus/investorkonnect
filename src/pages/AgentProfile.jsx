import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { introCreate, ndaStatus } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NDAModal from "@/components/NDAModal";
import { 
  Shield, Star, MapPin, Briefcase, Award,
  CheckCircle, Mail, Loader2, ArrowLeft, MessageCircle
} from "lucide-react";
import { toast } from "sonner";

export default function AgentProfile() {
  const { id } = useParams();
  const [searchParams] = React.useState(() => new URLSearchParams(window.location.search));
  const agentIdFromQuery = searchParams.get("id");
  const agentId = id || agentIdFromQuery;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    checkNDAAndLoadProfile();
  }, [agentId]);

  const checkNDAAndLoadProfile = async () => {
    try {
      // Check if authenticated
      const isAuth = await base44.auth.isAuthenticated();
      
      if (!isAuth) {
        toast.info("Please sign in to view agent profiles");
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }

      // Check NDA status
      const response = await ndaStatus();
      const data = response.data;

      if (!data.nda?.accepted) {
        setShowNDAModal(true);
        setLoading(false);
        return;
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
      // Get agent profile
      const profiles = await base44.entities.Profile.filter({ id: agentId });
      
      if (profiles.length === 0) {
        toast.error("Agent not found");
        navigate(createPageUrl("Reviews"));
        return;
      }

      const agentProfile = profiles[0];
      
      // Verify this is an agent profile
      if (agentProfile.user_type !== 'agent') {
        toast.error("Profile not found");
        navigate(createPageUrl("Reviews"));
        return;
      }

      setProfile(agentProfile);

      // Load reviews for this agent
      const agentReviews = await base44.entities.Review.filter({
        reviewee_profile_id: agentId,
        verified: true,
        moderation_status: "approved"
      }, '-created_date');
      
      setReviews(agentReviews);
      setLoading(false);

    } catch (error) {
      console.error('Profile load error:', error);
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
    try {
      const currentUser = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ email: currentUser.email });
      
      if (profiles.length === 0) {
        toast.error("Please complete your profile first");
        navigate(createPageUrl("Onboarding"));
        return;
      }

      const investorProfile = profiles[0];

      // Create intro request
      await introCreate({
        investorId: investorProfile.id,
        agentId: profile.id,
        message: ""
      });

      toast.success("Connection request sent!");
      navigate(createPageUrl("Inbox"));

    } catch (error) {
      console.error('Connect error:', error);
      toast.error("Failed to send connection request");
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
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    {profile.full_name || "Agent"}
                  </h1>
                  {profile.vetted && (
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
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-[#FFFBEB] rounded-xl p-4 border border-[#FDE68A]">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-[#D3A029] fill-[#D3A029]" />
                    <span className="text-2xl font-bold text-gray-900">
                      {avgRating || "N/A"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{reviews.length} Reviews</p>
                </div>
                <div className="bg-[#FFFBEB] rounded-xl p-4 border border-[#FDE68A]">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-[#D3A029]" />
                    <span className="text-2xl font-bold text-gray-900">
                      {profile.reputationScore || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Reputation Score</p>
                </div>
                <div className="bg-[#FFFBEB] rounded-xl p-4 border border-[#FDE68A]">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                    <span className="text-2xl font-bold text-gray-900">
                      {reviews.length}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">Transactions</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {profile.markets && profile.markets.length > 0 && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[#D3A029] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Markets</p>
                      <p className="text-gray-600">{profile.markets.join(", ")}</p>
                    </div>
                  </div>
                )}
                {profile.broker && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-[#D3A029] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Broker</p>
                      <p className="text-gray-600">{profile.broker}</p>
                    </div>
                  </div>
                )}
                {profile.licenseNumber && profile.licenseState && (
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-[#D3A029] mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">License</p>
                      <p className="text-gray-600">
                        {profile.licenseNumber} ({profile.licenseState})
                      </p>
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