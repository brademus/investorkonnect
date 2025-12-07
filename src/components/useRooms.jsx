import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Shared hook for loading rooms/deals across all pages
 * Ensures consistency between Pipeline, Room/Messages, and other pages
 * ALWAYS merges database rooms with sessionStorage rooms
 */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      try {
        // Load from both sources
        let dbRooms = [];
        try {
          dbRooms = await base44.entities.Room.list('-created_date', 100) || [];
        } catch (err) {
          console.log('[useRooms] Database load failed, will use local only:', err.message);
        }
        
        // Load from sessionStorage
        const localRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        
        // Merge: prioritize database rooms, then add local rooms that don't exist in DB
        const dbIds = new Set(dbRooms.map(r => r.id));
        const uniqueLocalRooms = localRooms.filter(r => !dbIds.has(r.id));
        
        const allRooms = [...dbRooms, ...uniqueLocalRooms];
        
        console.log(`[useRooms] Loaded ${dbRooms.length} from DB + ${uniqueLocalRooms.length} from local = ${allRooms.length} total`);
        
        return allRooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        
        // Final fallback to sessionStorage only
        const demoRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        return demoRooms;
      }
    },
    initialData: [],
    staleTime: 1000, // Consider data fresh for 1 second
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}