import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Star } from "lucide-react";

export default function AdminReviewsTab({ profiles }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const getProfileName = (id) => {
    const p = profiles.find(pr => pr.id === id);
    return p?.full_name || p?.email || id || 'Unknown';
  };

  useEffect(() => {
    base44.entities.Review.list('-created_date', 100)
      .then(r => setReviews(r || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Star className="w-5 h-5 text-[#E3C567]" />
          <div>
            <p className="text-xs text-[#808080]">Avg Rating</p>
            <p className="text-xl font-bold text-[#FAFAFA]">{avgRating}</p>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Star className="w-5 h-5 text-[#808080]" />
          <div>
            <p className="text-xs text-[#808080]">Total Reviews</p>
            <p className="text-xl font-bold text-[#FAFAFA]">{reviews.length}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-[#E3C567] animate-spin" /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-[#808080] text-sm">No reviews yet.</div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#FAFAFA]">{getProfileName(r.reviewer_profile_id)}</span>
                  <span className="text-[#808080] text-xs">→</span>
                  <span className="text-sm text-[#808080]">{getProfileName(r.reviewee_profile_id)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className={`w-3 h-3 ${i <= (r.rating || 0) ? 'text-[#E3C567] fill-[#E3C567]' : 'text-[#808080]'}`} />
                  ))}
                </div>
              </div>
              {r.body && <p className="text-sm text-[#808080]">{r.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}