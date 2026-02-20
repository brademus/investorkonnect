import React, { useState, useEffect } from "react";
import { Star, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function InlineAgentReviewForm({ dealId, investorProfileId, onSubmitted, compact = false }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setCurrentProfile).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentProfile?.id || !investorProfileId || !dealId) return;
    base44.entities.Review.filter({ 
      deal_id: dealId,
      reviewee_profile_id: investorProfileId, 
      reviewer_profile_id: currentProfile.id 
    }).then(reviews => {
      if (reviews.length > 0) {
        const rev = reviews[0];
        setExistingReview(rev);
        setRating(rev.rating || 0);
        setReview(rev.body || "");
        setIsEditing(false);
      } else {
        setExistingReview(null);
        setRating(0);
        setReview("");
      }
    }).catch(() => {});
  }, [currentProfile?.id, investorProfileId, dealId, refreshKey]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    if (!currentProfile?.id) {
      toast.error("Unable to submit review");
      return;
    }
    setSubmitting(true);
    try {
      if (existingReview && isEditing) {
        await base44.entities.Review.update(existingReview.id, {
          rating,
          body: review
        });
        toast.success("Review updated!");
        setExistingReview({ ...existingReview, rating, body: review });
        setIsEditing(false);
        setRefreshKey(k => k + 1);
      } else {
       await base44.entities.Review.create({
         deal_id: dealId,
         reviewee_profile_id: investorProfileId,
         reviewer_profile_id: currentProfile.id,
         reviewer_name: currentProfile.full_name || currentProfile.email,
         rating,
         body: review,
         verified: true,
         moderation_status: "approved"
       });
       toast.success("Review submitted!");
       setRating(0);
       setReview("");
       if (onSubmitted) onSubmitted();
      }
    } catch (e) {
      toast.error(isEditing ? "Failed to update review" : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (existingReview && !isEditing) {
    return (
      <div className={`border border-[#1F1F1F] rounded-xl p-4 ${compact ? 'bg-[#0D0D0D]' : 'bg-[#141414]'}`}>
        <div className="flex items-start justify-between mb-3">
          <p className={`font-semibold text-[#FAFAFA] ${compact ? 'text-xs' : 'text-sm'}`}>Your Review</p>
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs text-[#E3C567] hover:text-[#EDD89F] transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            Edit
          </button>
        </div>
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              className={`${
                i <= existingReview.rating
                  ? "fill-[#E3C567] text-[#E3C567]"
                  : "text-[#333]"
              } ${compact ? 'w-3 h-3' : 'w-4 h-4'}`}
            />
          ))}
        </div>
        {existingReview.body && (
          <p className={`text-[#FAFAFA] ${compact ? 'text-xs' : 'text-sm'}`}>{existingReview.body}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`border border-[#1F1F1F] rounded-xl p-4 ${compact ? 'bg-[#0D0D0D]' : 'bg-[#141414]'}`}>
      <div className="mb-3">
        <p className={`font-semibold text-[#FAFAFA] mb-2 ${compact ? 'text-xs' : 'text-sm'}`}>{isEditing ? "Edit your review" : "Rate this investor"}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onClick={() => setRating(i)}
              className="p-1 transition-colors"
            >
              <Star
                className={`${
                  i <= rating
                    ? "fill-[#E3C567] text-[#E3C567]"
                    : "text-[#333]"
                } ${compact ? 'w-4 h-4' : 'w-5 h-5'}`}
              />
            </button>
          ))}
        </div>
      </div>
      <input
        type="text"
        placeholder="Write a brief review..."
        value={review}
        onChange={(e) => setReview(e.target.value)}
        className={`w-full bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg px-3 py-2 text-[#FAFAFA] placeholder-[#666] focus:outline-none focus:border-[#E3C567] ${compact ? 'text-xs py-1' : 'text-sm py-2'}`}
      />
      <div className="flex gap-2 mt-3">
        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className={`flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full ${compact ? 'text-xs h-7' : 'text-sm h-8'}`}
        >
          {submitting ? "Saving..." : isEditing ? "Save Changes" : "Submit Review"}
        </Button>
        {isEditing && (
          <Button
            onClick={() => setIsEditing(false)}
            variant="outline"
            className={`flex-1 rounded-full ${compact ? 'text-xs h-7' : 'text-sm h-8'}`}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}