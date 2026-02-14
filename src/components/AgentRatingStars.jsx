import React from "react";
import { Star } from "lucide-react";

/**
 * Displays star rating for an agent.
 * Props:
 *   - rating: number (average rating, e.g. 4.3)
 *   - reviewCount: number (total reviews)
 *   - size: "sm" | "md" | "lg" (default "sm")
 *   - showCount: boolean (default true)
 */
export default function AgentRatingStars({ rating, reviewCount = 0, size = "sm", showCount = true }) {
  const starSize = size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const textSize = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";

  if (!rating && reviewCount === 0) {
    return (
      <div className={`flex items-center gap-1 ${textSize}`}>
        <Star className={`${starSize} text-[#333]`} />
        <span className="text-[#808080]">No reviews yet</span>
      </div>
    );
  }

  const displayRating = rating ? Number(rating).toFixed(1) : "0.0";

  return (
    <div className={`flex items-center gap-1.5 ${textSize}`}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`${starSize} ${
              i <= Math.round(rating || 0)
                ? "text-[#E3C567] fill-[#E3C567]"
                : "text-[#333]"
            }`}
          />
        ))}
      </div>
      <span className="text-[#FAFAFA] font-medium">{displayRating}</span>
      {showCount && reviewCount > 0 && (
        <span className="text-[#808080]">({reviewCount})</span>
      )}
    </div>
  );
}