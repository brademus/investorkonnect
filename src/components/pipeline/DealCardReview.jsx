import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Star } from "lucide-react";

/**
 * Shows star rating + first-line review snippet for a deal's agent on completed/canceled pipeline cards.
 * Only renders if a review exists for this deal's agent.
 */
export default function DealCardReview({ agentProfileId, reviewerProfileId }) {
  const [review, setReview] = useState(null);

  useEffect(() => {
    if (!agentProfileId || !reviewerProfileId) return;
    let cancelled = false;
    base44.entities.Review.filter({ reviewee_profile_id: agentProfileId, reviewer_profile_id: reviewerProfileId })
      .then(reviews => {
        if (cancelled || !reviews?.length) return;
        setReview(reviews[0]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [agentProfileId, reviewerProfileId]);

  if (!review) return null;

  const rating = review.rating || 0;
  const bodySnippet = review.body ? (review.body.length > 60 ? review.body.slice(0, 60) + '…' : review.body) : null;

  return (
    <div className="mt-2 pt-2 border-t border-[#1F1F1F]">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? "text-[#E3C567] fill-[#E3C567]" : "text-[#333]"}`} />
        ))}
        <span className="text-[10px] text-[#FAFAFA] font-medium ml-1">{Number(rating).toFixed(1)}</span>
      </div>
      {bodySnippet && (
        <p className="text-[10px] text-[#808080] mt-1 line-clamp-1 italic">"{bodySnippet}"</p>
      )}
    </div>
  );
}