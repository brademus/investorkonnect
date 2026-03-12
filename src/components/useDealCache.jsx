import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Pre-fetches and caches deal details for all rooms in the sidebar.
 * Returns helpers to instantly access deal data by dealId.
 *
 * On first load, fires a single bulk API call (getDealDetailsForUserBulk)
 * to fetch all deals at once — subsequent room switches read from cache.
 */
export function useDealCache(rooms, profile) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(new Set());

  // Bulk-fetch full deal details for all sidebar rooms (single API call)
  useEffect(() => {
    if (!rooms?.length || !profile?.id) return;

    const dealIds = rooms
      .map(r => r.deal_id)
      .filter(Boolean)
      .filter(id => !prefetchedRef.current.has(id));

    if (dealIds.length === 0) return;

    // Mark immediately to prevent duplicate calls
    dealIds.forEach(id => prefetchedRef.current.add(id));

    let cancelled = false;
    base44.functions.invoke('getDealDetailsForUserBulk', { dealIds })
      .then(res => {
        if (cancelled) return;
        const deals = res?.data?.deals || {};
        Object.entries(deals).forEach(([dealId, dealData]) => {
          queryClient.setQueryData(['dealDetails', dealId], dealData);
        });
      })
      .catch(err => {
        console.warn('[useDealCache] Bulk prefetch failed:', err?.message);
        // Clear flags so individual fetches can retry
        dealIds.forEach(id => prefetchedRef.current.delete(id));
      });

    return () => { cancelled = true; };
  }, [rooms, profile?.id, queryClient]);

  /**
   * Get cached deal data by dealId — returns instantly from React Query cache.
   */
  const getDeal = useCallback((dealId) => {
    if (!dealId) return null;
    return queryClient.getQueryData(['dealDetails', dealId]) || null;
  }, [queryClient]);

  /**
   * Patch cached deal data (e.g. after local upload or real-time update).
   */
  const patchDeal = useCallback((dealId, patch) => {
    if (!dealId) return;
    queryClient.setQueryData(['dealDetails', dealId], (prev) => {
      if (!prev) return patch;
      const merged = { ...prev, ...patch };
      if (patch.documents) {
        merged.documents = { ...(prev.documents || {}), ...patch.documents };
      }
      return merged;
    });
  }, [queryClient]);

  return { getDeal, patchDeal };
}