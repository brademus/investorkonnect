import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Shared hook for loading rooms/deals across all pages
 * Ensures consistency between Pipeline, Room/Messages, and other pages
 */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      try {
        // Try to load from database
        const rooms = await base44.entities.Room.list('-created_date', 100);
        
        // If we have rooms in database, use those
        if (rooms && rooms.length > 0) {
          return rooms;
        }
        
        // Otherwise check sessionStorage for demo rooms
        const demoRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        if (demoRooms.length > 0) {
          return demoRooms;
        }
        
        // Return empty array if no data
        return [];
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        
        // Fallback to sessionStorage on error
        const demoRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        return demoRooms;
      }
    },
    initialData: [],
  });
}