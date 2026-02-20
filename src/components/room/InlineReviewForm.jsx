import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { invalidateRatingCache } from "@/components/useAgentRating";

export default function InlineReviewForm({ deal, room, profile }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAgent = profile?.user_role === 'agent' && profile?.role !== 'admin';
  const revieweeId = isAgent
    ? (deal?.investor_id || room?.investorId)
    : (deal?.locked_agent_id || room?.locked_agent_id || room?.agent_ids?.[0]);

  useEffect(() => {
    if (!profile?.id || !revieweeId) { setLoading(false); return; }
    base44.entities.Review.filter({ reviewee_profile_id: revieweeId, reviewer_profile_id: profile.id })
      .then(reviews => {
        const existing = reviews?.[0];
        if (existing) {
          setExistingReview(existing);
          setRating(existing.rating);
          setReviewBody(existing.body || "");
          setSubmitted(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.id, revieweeId]);

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Please select a star rating"); return; }
    setSubmitting(true);
    try {
      const body = reviewBody.trim() || `${rating}-star rating`;
      const data = {
        reviewee_profile_id: revieweeId,
        reviewer_profile_id: profile.id,
        reviewer_name: profile.full_name || profile.email,
        rating,
        body,
        verified: true,
        market: deal?.state || "",
        deal_type: deal?.property_type || "",
      };
      if (existingReview) {
        await base44.entities.Review.update(existingReview.id, data);
      } else {
        await base44.entities.Review.create(data);
      }
      invalidateRatingCache(revieweeId);
      setSubmitted(true);
      toast.success("Review submitted!");
    } catch (e) {
      toast.error("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!revieweeId) return null;

  if (submitted) {
    return (
      <div className="mt-3 pt-3 border-t border-[#1F1F1F]">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
          <span className="text-xs font-medium text-[#10B981]">Review Submitted</span>
        </div>
        <div className="flex gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map(s => (
            <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? 'text-[#E3C567] fill-[#E3C567]' : 'text-[#333]'}`} />
          ))}
        </div>
        <button onClick={() => setSubmitted(false)} className="text-xs text-[#808080] hover:text-[#E3C567] mt-1">
          Edit Review
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#1F1F1F] space-y-3">
      <p className="text-xs font-medium text-[#FAFAFA]">
        {isAgent ? "Rate your investor" : "Rate your agent"}
      </p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="transition-transform hover:scale-110"
          >
            <Star className={`w-7 h-7 transition-colors ${
              star <= (hoverRating || rating) ? 'text-[#E3C567] fill-[#E3C567]' : 'text-[#333] hover:text-[#555]'
            }`} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <Textarea
          value={reviewBody}
          onChange={e => setReviewBody(e.target.value)}
          placeholder="Share your experience (optional)..."
          className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] placeholder:text-[#555] rounded-xl min-h-[80px] text-sm focus:border-[#E3C567]"
        />
      )}
      {rating > 0 && (
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          size="sm"
          className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold text-xs h-9"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          {existingReview ? "Update Review" : "Submit Review"}
        </Button>
      )}
    </div>
  );
}