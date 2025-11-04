import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    checkNDAAndLoadProfile();
  }, [id]);

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
      const response = await base44.functions.invoke('ndaStatus');
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
      const profiles = await base44.entities.Profile.filter({ id });
      
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
        reviewee_profile_id: id,
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
      await base44.functions.invoke('introCreate', {
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
        className={`w-5 h-5 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`}
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (showNDAModal) {
    return <NDAModal open={showNDAModal} onAccepted={handleNDAAccepted} />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Profile Not Found</h2>
          <Link to={createPageUrl("Reviews")}>
            <Button>Back to Agents</Button>
          </Link>
        </div>
      </div>
    );
  }

  const avgRating = calculateAverageRating();

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">
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
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified Agent
                    </Badge>
                  )}
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleConnect}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-2xl font-bold text-slate-900">
                      {avgRating || "N/A"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{reviews.length} Reviews</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-blue-500" />
                    <span className="text-2xl font-bold text-slate-900">
                      {profile.reputationScore || 0}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">Reputation Score</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-2xl font-bold text-slate-900">
                      {reviews.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">Transactions</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {profile.markets && profile.markets.length > 0 && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Markets</p>
                      <p className="text-slate-600">{profile.markets.join(", ")}</p>
                    </div>
                  </div>
                )}
                {profile.broker && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Broker</p>
                      <p className="text-slate-600">{profile.broker}</p>
                    </div>
                  </div>
                )}
                {profile.licenseNumber && profile.licenseState && (
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">License</p>
                      <p className="text-slate-600">
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
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">About</h3>
              <p className="text-slate-700 leading-relaxed">{profile.bio}</p>
            </div>
          )}
        </div>

        {/* Reviews Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Verified Reviews ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div 
                  key={review.id} 
                  className="border-b border-slate-200 last:border-0 pb-6 last:pb-0"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">{renderStars(review.rating)}</div>
                        <span className="text-sm font-semibold text-slate-900">
                          {review.rating}.0
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {review.reviewer_name}
                      </p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                      <Shield className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <p className="text-slate-700 leading-relaxed mb-2">{review.body}</p>
                  {review.market && (
                    <Badge variant="secondary" className="text-xs">
                      {review.market}
                    </Badge>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
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