import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Placeholder deals removed as requested.
// The system now relies on real database deals via listMyRooms.

/**
 * Enrich room with full profile data from matched counterparty
 */
async function enrichRoomWithProfile(room) {
  try {
    // Determine which profile ID to fetch
    const counterpartyId = room.agentId || room.investorId;
    
    if (!counterpartyId) {
      return room; // No counterparty, return as-is
    }
    
    // Fetch the counterparty's profile
    const profiles = await base44.entities.Profile.filter({ id: counterpartyId });
    const profile = profiles[0];
    
    if (!profile) {
      return room; // Profile not found, return as-is
    }
    
    // Enrich room with profile data
    return {
      ...room,
      counterparty_name: profile.full_name || profile.email || room.counterparty_name,
      counterparty_email: profile.email,
      counterparty_role: profile.user_role || profile.role,
      counterparty_company: profile.company || profile.agent?.brokerage || profile.investor?.company_name,
      counterparty_phone: profile.phone || profile.agent?.phone,
      counterparty_profile: profile, // Include full profile for detailed views
    };
  } catch (error) {
    console.error(`[enrichRoomWithProfile] Error enriching room ${room.id}:`, error);
    return room; // Return original room on error
  }
}

/**
 * Normalize room data structure for consistent display across all pages
 */
function normalizeRoom(room) {
  return {
    ...room,
    // Ensure messages sidebar fields exist
    counterparty_name: room.counterparty_name || room.customer_name || room.title || 'Deal Room',
    counterparty_role: room.counterparty_role || (room.agentId ? 'agent' : room.investorId ? 'investor' : 'partner'),
    // Ensure pipeline fields exist
    title: room.title || room.counterparty_name || room.customer_name || 'Deal Room',
    property_address: room.property_address || null,
    customer_name: room.customer_name || room.counterparty_name || null,
    budget: room.budget || room.contract_price || null,
    pipeline_stage: room.pipeline_stage || 'new_contract',
  };
}

/**
 * Shared hook for loading rooms/deals across all pages
 * Ensures consistency between Pipeline, Room/Messages, and other pages
 * ALWAYS merges database rooms with sessionStorage rooms
 * Enriches rooms with full profile data from matched agents/investors
 * Shows role-appropriate placeholder deals when no real data exists
 */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      try {
        // Determine current user role
        let userRole = 'investor'; // default
        try {
          const user = await base44.auth.me();
          if (user) {
            const profiles = await base44.entities.Profile.filter({ user_id: user.id });
            if (profiles[0]) {
              userRole = profiles[0].user_role || profiles[0].role || 'investor';
            }
          }
        } catch (err) {
          console.log('[useRooms] Could not determine user role, defaulting to investor');
        }
        
        // Load from database only
        let dbRooms = [];
        try {
          dbRooms = await base44.entities.Room.list('-created_date', 100) || [];
        } catch (err) {
          console.log('[useRooms] Database load failed:', err.message);
        }
        
        let allRooms = [...dbRooms];
        
        // Enrich real rooms with profile data
        allRooms = await Promise.all(allRooms.map(enrichRoomWithProfile));
        
        // Normalize all rooms for consistent display
        const normalizedRooms = allRooms.map(normalizeRoom);
        
        console.log(`[useRooms] Loaded ${dbRooms.length} from DB`);
        
        return normalizedRooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        return [];
      }
    },
    initialData: [],
    staleTime: 1000, // Consider data fresh for 1 second
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}