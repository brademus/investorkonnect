import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Star, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { invalidateRatingCache } from "@/components/useAgentRating";

/**
 * Compact inline review widget for pipeline deal cards.
 * Shows clickable stars + a single-line text input.
 * If a review exists, pre-fills it; user can edit inline.
 */
export default function DealCardReview({ agentProfileId, reviewerProfileId, dealId, dealState, dealPropertyType }) {
  const [review, setReview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!agentProfileId || !reviewerProfileId) { setLoaded(true); return; }
    let cancelled = false;
    base44.entities.Review.filter({ reviewee_profile_id: agentProfileId, reviewer_profile_id: reviewerProfileId })
      .then(reviews => {
        if (cancelled) return;
        if (reviews?.length) {
          const r = reviews[0];
          setReview(r);
          setRating(r.rating || 0);
          setBody(r.body || "");
        }
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [agentProfileId, reviewerProfileId]);

  if (!loaded || !agentProfileId) return null;

  const save = async (newRating, newBody) => {
    if (newRating === 0) return;
    setSaving(true);
    const data = {
      reviewee_profile_id: agentProfileId,
      reviewer_profile_id: reviewerProfileId,
      reviewer_name: "",
      rating: newRating,
      body: newBody.trim() || `${newRating}-star rating`,
      verified: true,
      market: dealState || "",
      deal_type: dealPropertyType || "",
    };
    try {
      if (review) {
        await base44.entities.Review.update(review.id, data);
        setReview({ ...review, ...data });
      } else {
        const created = await base44.entities.Review.create(data);
        setReview(created);
      }
      invalidateRatingCache(agentProfileId);
      setDirty(false);
      toast.success("Review saved");
    } catch {
      toast.error("Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  const handleStarClick = (star) => {
    setRating(star);
    setDirty(true);
    // Auto-save on star click after short delay
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(star, body), 600);
  };

  const handleBodyChange = (e) => {
    setBody(e.target.value);
    setDirty(true);
  };

  const handleBodyKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rating > 0) save(rating, body);
    }
  };

  const handleBodyBlur = () => {
    clearTimeout(debounceRef.current);
    if (dirty && rating > 0) save(rating, body);
  };

  return (
    <div className="mt-2 pt-2 border-t border-[#1F1F1F]" onClick={e => e.stopPropagation()}>
      {/* Stars row */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0 transition-transform hover:scale-125"
          >
            <Star className={`w-4 h-4 transition-colors ${
              star <= (hoverRating || rating) ? 'text-[#E3C567] fill-[#E3C567]' : 'text-[#333] hover:text-[#555]'
            }`} />
          </button>
        ))}
        {saving && <Loader2 className="w-3 h-3 text-[#E3C567] animate-spin ml-1.5" />}
        {!saving && !dirty && review && <Check className="w-3 h-3 text-[#10B981] ml-1.5" />}
      </div>
      {/* One-line review input */}
      <input
        type="text"
        value={body}
        onChange={handleBodyChange}
        onKeyDown={handleBodyKeyDown}
        onBlur={handleBodyBlur}
        placeholder="Write a short review..."
        className="w-full mt-1.5 bg-[#141414] border border-[#1F1F1F] rounded-lg px-2.5 py-1.5 text-[11px] text-[#FAFAFA] placeholder:text-[#444] focus:border-[#E3C567] focus:outline-none transition-colors"
      />
    </div>
  );
}