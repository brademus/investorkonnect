import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { invalidateRatingCache } from "@/components/useAgentRating";

export default function RateAgent() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const dealId = params.get("dealId");
  const agentProfileId = params.get("agentProfileId");
  const returnTo = params.get("returnTo") || "Pipeline";
  const { profile } = useCurrentProfile();

  const [agentProfile, setAgentProfile] = useState(null);
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    if (!agentProfileId || !dealId || !profile?.id) return;

    const load = async () => {
      setLoading(true);
      try {
        const [agents, deals, reviews] = await Promise.all([
          base44.entities.Profile.filter({ id: agentProfileId }),
          base44.entities.Deal.filter({ id: dealId }),
          base44.entities.Review.filter({ reviewee_profile_id: agentProfileId, reviewer_profile_id: profile.id }),
        ]);
        setAgentProfile(agents?.[0] || null);
        setDeal(deals?.[0] || null);

        // Check if already reviewed
        const existing = reviews?.find(r => r.reviewee_profile_id === agentProfileId && r.reviewer_profile_id === profile.id);
        if (existing) {
          setExistingReview(existing);
          setRating(existing.rating);
          setReviewBody(existing.body || "");
        }
      } catch (_) {}
      setLoading(false);
    };
    load();
  }, [agentProfileId, dealId, profile?.id]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a star rating");
      return;
    }
    setSubmitting(true);
    try {
      const body = reviewBody.trim() || `${rating}-star rating`;
      const data = {
        reviewee_profile_id: agentProfileId,
        reviewer_profile_id: profile.id,
        reviewer_name: profile.full_name || profile.email,
        rating,
        body,
        verified: true,
        market: deal?.state || "",
        deal_type: deal?.property_type || "",
      };

      console.log("[RateAgent] Submitting review:", data);

      if (existingReview) {
        await base44.entities.Review.update(existingReview.id, data);
      } else {
        await base44.entities.Review.create(data);
      }

      console.log("[RateAgent] Review saved successfully");

      // Bust the rating cache so AgentProfile page shows fresh data immediately
      invalidateRatingCache(agentProfileId);

      setSubmitted(true);
      toast.success("Thank you for your review!");
      setTimeout(() => navigate(createPageUrl(returnTo)), 1500);
    } catch (e) {
      console.error("[RateAgent] Submit error:", e);
      toast.error("Failed to submit review: " + (e?.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigate(createPageUrl(returnTo));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E3C567] animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-[#10B981] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Thank You!</h2>
          <p className="text-[#808080]">Your review has been submitted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8 px-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={handleSkip}
          className="text-[#808080] hover:text-[#E3C567] text-sm flex items-center gap-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Pipeline
        </button>

        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#E3C567] mb-2">Rate Your Agent</h1>
            <p className="text-sm text-[#808080]">
              How was your experience working with{" "}
              <span className="text-[#FAFAFA] font-medium">{agentProfile?.full_name || "this agent"}</span>?
            </p>
            {deal?.property_address && (
              <p className="text-xs text-[#808080] mt-1">{deal.property_address}</p>
            )}
          </div>

          {/* Star Rating */}
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 transition-colors ${
                    star <= (hoverRating || rating)
                      ? "text-[#E3C567] fill-[#E3C567]"
                      : "text-[#333] hover:text-[#555]"
                  }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="text-center text-sm text-[#E3C567] mb-6">
              {rating === 1 && "Poor"}
              {rating === 2 && "Below Average"}
              {rating === 3 && "Average"}
              {rating === 4 && "Good"}
              {rating === 5 && "Excellent"}
            </p>
          )}

          {/* Review Text */}
          <div className="mb-6">
            <label className="text-sm text-[#808080] mb-2 block">
              Write a review (optional)
            </label>
            <Textarea
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              placeholder="Share your experience working with this agent..."
              className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#555] rounded-xl min-h-[120px] focus:border-[#E3C567]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1 bg-transparent border-[#1F1F1F] text-[#808080] hover:text-[#FAFAFA] hover:border-[#E3C567] rounded-full"
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
              className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {existingReview ? "Update Review" : "Submit Review"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}