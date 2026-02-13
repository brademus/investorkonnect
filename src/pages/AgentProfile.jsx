import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, MapPin, Award, Briefcase, Star, ExternalLink, Clock, TrendingUp, Home, CreditCard } from "lucide-react";
import DigitalBusinessCard from "@/components/DigitalBusinessCard";

export default function AgentProfile() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const profileId = params.get("profileId") || params.get("agentId");
  const { profile: currentProfile } = useCurrentProfile();
  
  const [agentProfile, setAgentProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dealsCompleted, setDealsCompleted] = useState(null);

  useEffect(() => {
    if (!profileId) return;
    
    setLoading(true);
    setAgentProfile(null);
    setReviews([]);
    
    const loadProfile = async () => {
      try {
        const profiles = await base44.entities.Profile.filter({ id: profileId });
        const agent = profiles[0];
        
        if (!agent) {
          setLoading(false);
          return;
        }

        setAgentProfile(agent);

        try {
          const agentReviews = await base44.entities.Review.filter({ 
            reviewee_profile_id: profileId 
          }, '-created_date', 10);
          setReviews(agentReviews || []);
        } catch (err) {
          console.log('Reviews not available:', err);
          setReviews([]);
        }

        try {
          const completedDeals = await base44.entities.Deal.filter({ 
            locked_agent_id: profileId,
            pipeline_stage: { $in: ['ready_to_close', 'completed'] }
          });
          setDealsCompleted(completedDeals?.length || 0);
        } catch (err) {
          console.log('Could not compute deals completed:', err);
          setDealsCompleted(null);
        }

      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [profileId]);

  // Compute average rating from reviews
  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : agentProfile?.reputationScore || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  if (!agentProfile) {
    return (
      <div className="min-h-screen bg-transparent py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => navigate(-1)}
            className="mb-6 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#E3C567]/40 hover:border-[#E3C567] rounded-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
            <p className="text-[#808080]">Agent profile not found</p>
          </div>
        </div>
      </div>
    );
  }

  const agent = agentProfile.agent || {};
  const markets = agent.markets || agentProfile.markets || [];
  const specialties = agent.specialties || [];
  const experienceYears = agent.experience_years || agent.investor_experience_years;
  const dealsLast12m = agent.investment_deals_last_12m;
  const investmentStrategies = agent.investment_strategies || [];
  const responseTime = agent.typical_response_time;

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Button
          onClick={() => navigate(-1)}
          className="mb-6 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#E3C567]/40 hover:border-[#E3C567] rounded-full"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Digital Business Card */}
        <div className="mb-6">
          <DigitalBusinessCard agentProfile={agentProfile} ikDealsCount={dealsCompleted} />
        </div>

        {/* Uploaded Business Card */}
        {agentProfile.businessCardUrl && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[#FAFAFA] mb-3">Uploaded Business Card</h3>
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl overflow-hidden">
              <img
                src={agentProfile.businessCardUrl}
                alt={`${agentProfile.full_name}'s business card`}
                className="w-full object-contain max-h-[400px]"
              />
            </div>
          </div>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
            <h3 className="text-xl font-bold text-[#FAFAFA] mb-6">Client Reviews</h3>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div 
                  key={review.id}
                  className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating 
                              ? 'text-[#E3C567] fill-[#E3C567]' 
                              : 'text-[#333]'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-[#808080]">
                      {review.reviewer_name || 'Anonymous'}
                    </span>
                  </div>
                  <p className="text-sm text-[#FAFAFA]/80 leading-relaxed">
                    {review.body}
                  </p>
                  {review.market && (
                    <p className="text-xs text-[#808080] mt-2">
                      Deal in {review.market}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {reviews.length === 0 && (
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
            <Star className="w-12 h-12 text-[#808080] mx-auto mb-4 opacity-50" />
            <p className="text-sm text-[#808080]">Reviews coming soon</p>
          </div>
        )}


      </div>
    </div>
  );
}