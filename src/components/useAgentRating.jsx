import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Module-level cache to avoid redundant fetches within a session
const _ratingCache = {};

/**
 * Invalidate the rating cache for a specific agent (or all agents).
 * Call this after creating/updating a review so the next render fetches fresh data.
 */
export function invalidateRatingCache(agentProfileId) {
  if (agentProfileId) {
    delete _ratingCache[agentProfileId];
  } else {
    Object.keys(_ratingCache).forEach(k => delete _ratingCache[k]);
  }
}

/**
 * Hook to fetch an agent's average rating and review count.
 * Returns { rating, reviewCount, loading }
 */
export function useAgentRating(agentProfileId) {
  const cached = agentProfileId ? _ratingCache[agentProfileId] : null;
  const [data, setData] = useState(cached || { rating: null, reviewCount: 0 });
  const [loading, setLoading] = useState(!cached);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to Review entity changes — invalidate cache & refetch when reviews change
  useEffect(() => {
    if (!agentProfileId) return;
    const unsub = base44.entities.Review.subscribe((event) => {
      const d = event?.data;
      if (d?.reviewee_profile_id === agentProfileId) {
        delete _ratingCache[agentProfileId];
        setRefreshKey(k => k + 1);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [agentProfileId]);

  useEffect(() => {
    if (!agentProfileId) return;
    if (_ratingCache[agentProfileId]) {
      setData(_ratingCache[agentProfileId]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    base44.entities.Review.filter({ reviewee_profile_id: agentProfileId })
      .then((reviews) => {
        if (cancelled) return;
        const validReviews = (reviews || []).filter(r => r.rating);
        const count = validReviews.length;
        const avg = count > 0
          ? validReviews.reduce((sum, r) => sum + r.rating, 0) / count
          : null;
        const result = { rating: avg, reviewCount: count };
        _ratingCache[agentProfileId] = result;
        setData(result);
      })
      .catch(() => {
        if (!cancelled) setData({ rating: null, reviewCount: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [agentProfileId, refreshKey]);

  return { ...data, loading };
}

/**
 * Batch fetch ratings for multiple agents at once.
 * Returns a Map of agentProfileId -> { rating, reviewCount }
 */
export async function fetchAgentRatings(agentProfileIds) {
  const results = new Map();
  const toFetch = [];

  for (const id of agentProfileIds) {
    if (_ratingCache[id]) {
      results.set(id, _ratingCache[id]);
    } else {
      toFetch.push(id);
    }
  }

  if (toFetch.length > 0) {
    // Fetch all reviews for these agents in parallel
    const fetches = toFetch.map(async (id) => {
      try {
        const reviews = await base44.entities.Review.filter({ reviewee_profile_id: id });
        const validReviews = (reviews || []).filter(r => r.rating);
        const count = validReviews.length;
        const avg = count > 0
          ? validReviews.reduce((sum, r) => sum + r.rating, 0) / count
          : null;
        const result = { rating: avg, reviewCount: count };
        _ratingCache[id] = result;
        results.set(id, result);
      } catch (_) {
        results.set(id, { rating: null, reviewCount: 0 });
      }
    });
    await Promise.all(fetches);
  }

  return results;
}