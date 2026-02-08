import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Shared hook for loading enriched rooms. Server does all the heavy lifting.
 * No client-side dedup hacks - server returns clean data.
 */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const response = await base44.functions.invoke('listMyRoomsEnriched');
      const rooms = response.data?.rooms || [];
      // Simple dedup by deal_id - keep highest priority room
      const byDeal = new Map();
      for (const r of rooms) {
        if (!r.deal_id) continue;
        const prev = byDeal.get(r.deal_id);
        if (!prev) { byDeal.set(r.deal_id, r); continue; }
        const score = (x) => (x.is_fully_signed ? 3 : x.request_status === 'accepted' ? 2 : 1);
        if (score(r) > score(prev)) byDeal.set(r.deal_id, r);
      }
      return [...byDeal.values()].sort((a, b) => new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0));
    },
  });
}