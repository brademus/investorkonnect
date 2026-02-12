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
          const completedDeals = await base44.asServiceRole.entities.Deal.filter({ 
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

        {/* Profile Card */}
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 mb-6">
          <div className="flex items-start gap-6 mb-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-[#E3C567]/20 rounded-full flex items-center justify-center flex-shrink-0">
              {agentProfile.headshotUrl ? (
                <img 
                  src={agentProfile.headshotUrl} 
                  alt={agentProfile.full_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-[#E3C567]">
                  {(agentProfile.full_name || 'A').charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-[#E3C567] mb-2">
                {agentProfile.full_name || 'Agent'}
              </h1>
              
              {agent.brokerage && (
                <p className="text-sm text-[#808080] mb-3">
                  {agent.brokerage}
                </p>
              )}

              {/* Stats Grid */}
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {averageRating && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#1F1F1F] rounded-full">
                    <Star className="w-4 h-4 text-[#E3C567] fill-[#E3C567]" />
                    <span className="text-sm font-semibold text-[#FAFAFA]">{averageRating}</span>
                    <span className="text-xs text-[#808080]">({reviews.length})</span>
                  </div>
                )}
                
                {(dealsCompleted !== null || dealsLast12m) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#1F1F1F] rounded-full">
                    <Briefcase className="w-4 h-4 text-[#E3C567]" />
                    <span className="text-sm text-[#FAFAFA]">
                      {dealsLast12m ? `${dealsLast12m} deals (12mo)` : `${dealsCompleted} on platform`}
                    </span>
                  </div>
                )}

                {experienceYears && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#1F1F1F] rounded-full">
                    <Award className="w-4 h-4 text-[#E3C567]" />
                    <span className="text-sm text-[#FAFAFA]">{experienceYears}+ years</span>
                  </div>
                )}

                {responseTime && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#1F1F1F] rounded-full">
                    <Clock className="w-4 h-4 text-[#E3C567]" />
                    <span className="text-sm text-[#FAFAFA]">{responseTime}</span>
                  </div>
                )}
              </div>

              {/* Markets */}
              {markets.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-[#808080]" />
                  <span className="text-sm text-[#808080]">
                    Markets: {markets.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {(agent.bio || agentProfile.bio) && (
            <div className="pt-6 border-t border-[#1F1F1F]">
              <h3 className="text-lg font-semibold text-[#FAFAFA] mb-3">About</h3>
              <p className="text-sm text-[#FAFAFA]/80 leading-relaxed whitespace-pre-wrap">
                {agent.bio || agentProfile.bio}
              </p>
            </div>
          )}

          {/* Investment Strategies */}
          {investmentStrategies.length > 0 && (
            <div className="pt-6 border-t border-[#1F1F1F]">
              <h3 className="text-lg font-semibold text-[#FAFAFA] mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#E3C567]" />
                Investment Strategies
              </h3>
              <div className="flex flex-wrap gap-2">
                {investmentStrategies.map((strategy, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1.5 rounded-full bg-[#E3C567]/10 border border-[#E3C567]/30 text-[#E3C567] text-xs font-medium"
                  >
                    {strategy}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Property Specialties */}
          {specialties.length > 0 && (
            <div className="pt-6 border-t border-[#1F1F1F]">
              <h3 className="text-lg font-semibold text-[#FAFAFA] mb-3 flex items-center gap-2">
                <Home className="w-5 h-5 text-[#E3C567]" />
                Property Specialties
              </h3>
              <div className="flex flex-wrap gap-2">
                {specialties.map((specialty, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1.5 rounded-full bg-[#141414] border border-[#1F1F1F] text-[#FAFAFA] text-xs font-medium"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social Links */}
          {(agent.linkedin_url || agent.instagram_url || agent.website_url) && (
            <div className="pt-6 border-t border-[#1F1F1F]">
              <h3 className="text-lg font-semibold text-[#FAFAFA] mb-3">Connect</h3>
              <div className="flex flex-wrap gap-3">
                {agent.linkedin_url && (
                  <a
                    href={agent.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-[#1F1F1F] rounded-full text-sm text-[#FAFAFA] hover:border-[#E3C567] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    LinkedIn
                  </a>
                )}
                {agent.instagram_url && (
                  <a
                    href={agent.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-[#1F1F1F] rounded-full text-sm text-[#FAFAFA] hover:border-[#E3C567] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Instagram
                  </a>
                )}
                {agent.website_url && (
                  <a
                    href={agent.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-[#1F1F1F] rounded-full text-sm text-[#FAFAFA] hover:border-[#E3C567] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Website
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

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

        {/* Generated Digital Business Card */}
        <div className="mt-6">
          <h3 className="text-lg font-bold text-[#FAFAFA] mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#E3C567]" />
            Digital Business Card
          </h3>
          <DigitalBusinessCard agentProfile={agentProfile} />
        </div>

        {/* Uploaded Business Card */}
        {agentProfile.businessCardUrl && (
          <div className="mt-6">
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
      </div>
    </div>
  );
}