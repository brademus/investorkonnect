import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Star, MessageSquarePlus } from "lucide-react";

/**
 * Shows star rating + review snippet on completed/canceled deal cards.
 * If no review exists yet, shows a "Leave a Review" link.
 */
export default function DealCardReview({ agentProfileId, reviewerProfileId, dealId }) {
  const [review, setReview] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!agentProfileId || !reviewerProfileId) { setLoaded(true); return; }
    let cancelled = false;
    base44.entities.Review.filter({ reviewee_profile_id: agentProfileId, reviewer_profile_id: reviewerProfileId })
      .then(reviews => {
        if (cancelled) return;
        if (reviews?.length) setReview(reviews[0]);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [agentProfileId, reviewerProfileId]);

  if (!loaded) return null;

  // No agent to review — hide entirely
  if (!agentProfileId) return null;

  // Existing review — show stars + snippet
  if (review) {
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

  // No review yet — show prompt
  return (
    <div className="mt-2 pt-2 border-t border-[#1F1F1F]">
      <Link
        to={`${createPageUrl("RateAgent")}?dealId=${dealId}&agentProfileId=${agentProfileId}&returnTo=Pipeline`}
        onClick={e => e.stopPropagation()}
        className="flex items-center gap-1.5 text-[11px] text-[#E3C567] hover:text-[#EDD89F] transition-colors"
      >
        <MessageSquarePlus className="w-3 h-3" />
        Leave a Review
      </Link>
    </div>
  );
}