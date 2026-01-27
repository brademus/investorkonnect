import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Central data normalization layer - single source of truth for deal/room data
 * Eliminates redundant deduplication logic and provides derived views
 */
export function useNormalizedDeals(profileId, userRole, enabled = true) {
  // Fetch raw deals - VERY aggressive cache: return cached immediately, NEVER auto-refetch
  const { data: rawDeals = [], isLoading: loadingDeals, refetch: refetchDeals } = useQuery({
    queryKey: ['normalizedDeals', profileId, userRole],
    staleTime: Infinity,              // NEVER stale - use cache forever
    gcTime: 24 * 60 * 60 * 1000,      // Keep in memory 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!profileId) return [];
      const response = await base44.functions.invoke('getPipelineDealsForUser');
      return (response.data?.deals || []).filter(d => d.status !== 'archived');
    },
    enabled: enabled && !!profileId,
  });

  // Fetch raw rooms - VERY aggressive cache: return cached immediately, NEVER auto-refetch
  const { data: rawRooms = [], isLoading: loadingRooms, refetch: refetchRooms } = useQuery({
    queryKey: ['normalizedRooms', profileId],
    staleTime: Infinity,              // NEVER stale - use cache forever
    gcTime: 24 * 60 * 60 * 1000,      // Keep in memory 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!profileId) return [];
      const res = await base44.functions.invoke('listMyRoomsEnriched');
      return res.data?.rooms || [];
    },
    enabled: enabled && !!profileId,
  });

  // Single deduplication pass - done once, cached by React Query
  const normalizedData = useMemo(() => {
    const normalize = (v) => (v ?? '').toString().trim().toLowerCase();
    const toDate = (d) => new Date(d || 0).getTime();
    const makeSig = (d) => {
      const addr = normalize(d.property_address || d.title);
      const city = normalize(d.city);
      const state = normalize(d.state);
      const zip = normalize(d.zip);
      const price = d.purchase_price ?? d.budget ?? '';
      return `${addr}|${city}|${state}|${zip}|${price}`;
    };

    // Dedupe deals
    const byId = new Map();
    for (const d of rawDeals) {
      const id = d?.id;
      if (!id) continue;
      const prev = byId.get(id);
      if (!prev || toDate(d.updated_date) > toDate(prev.updated_date)) {
        byId.set(id, d);
      }
    }

    const bySig = new Map();
    for (const d of byId.values()) {
      const sig = makeSig(d);
      const prev = bySig.get(sig);
      if (!prev || toDate(d.updated_date) > toDate(prev.updated_date)) {
        bySig.set(sig, d);
      }
    }

    const deals = Array.from(bySig.values());

    // Index rooms by deal_id, prefer signed
    const roomMap = new Map();
    const rank = (r) => 
      r?.request_status === 'signed' ? 3 : 
      r?.request_status === 'accepted' ? 2 : 
      r?.request_status === 'requested' ? 1 : -1;
    
    rawRooms.forEach(r => {
      if (!r?.deal_id) return;
      const current = roomMap.get(r.deal_id);
      if (!current || rank(r) > rank(current)) {
        roomMap.set(r.deal_id, r);
      }
    });

    return { deals, roomMap, rawRooms };
  }, [rawDeals, rawRooms]);

  return {
    deals: normalizedData.deals,
    rooms: normalizedData.rawRooms,
    isLoading: loadingDeals || loadingRooms,
    refetch: () => {
      refetchDeals();
      refetchRooms();
    }
  };
}