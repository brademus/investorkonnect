import React, { useState, useEffect } from "react";
import { Star, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function InlineReviewForm({ dealId, agentProfileId, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentProfile).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentProfile?.id || !agentProfileId) return;
    base44.entities.Review.filter({ 
      reviewee_profile_id: agentProfileId, 
      reviewer_profile_id: currentProfile.id 
    }).then(reviews => {
      if (reviews.length > 0) {
        const rev = reviews[0];
        setExistingReview(rev);
        setRating(rev.rating || 0);
        setReview(rev.body || "");
      }
    }).catch(() => {});
  }, [currentProfile?.id, agentProfileId]);

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
      } else {
        await base44.entities.Review.create({
          reviewee_profile_id: agentProfileId,
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
      <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-semibold text-[#FAFAFA]">Your Review</p>
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
              className={`w-4 h-4 ${
                i <= existingReview.rating
                  ? "fill-[#E3C567] text-[#E3C567]"
                  : "text-[#333]"
              }`}
            />
          ))}
        </div>
        {existingReview.body && (
          <p className="text-sm text-[#FAFAFA]">{existingReview.body}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[#FAFAFA] mb-2">{isEditing ? "Edit your review" : "Rate this agent"}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onClick={() => setRating(i)}
              className="p-1 transition-colors"
            >
              <Star
                className={`w-5 h-5 ${
                  i <= rating
                    ? "fill-[#E3C567] text-[#E3C567]"
                    : "text-[#333]"
                }`}
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
        className="w-full bg-[#0D0D0D] border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm text-[#FAFAFA] placeholder-[#666] focus:outline-none focus:border-[#E3C567]"
      />
      <Button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="w-full mt-2 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-sm h-8"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </Button>
    </div>
  );
}