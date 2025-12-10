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
    title: room.title || room.deal_title || null, // Only use real deal titles, don't fallback to names
    property_address: room.property_address || null,
    customer_name: room.customer_name || room.counterparty_name || null,
    budget: room.budget || room.contract_price || null,
    pipeline_stage: room.pipeline_stage || (room.deal_id ? 'new_deal_under_contract' : null),
    deal_title: room.deal_title || room.title || null,
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
        // Load from backend function listMyRooms
        // This function handles:
        // 1. Authentication check
        // 2. Fetching only rooms where user is participant (investor OR agent)
        // 3. Basic enrichment (counterparty name/role)
        let dbRooms = [];
        try {
          const response = await base44.functions.invoke('listMyRooms');
          if (response.data && response.data.items) {
            dbRooms = response.data.items;
          } else {
             // Fallback or empty
             dbRooms = [];
          }
        } catch (err) {
          console.log('[useRooms] Backend listMyRooms failed:', err.message);
        }
        
        let allRooms = [...dbRooms];

        // Removed session storage merging to ensure only real database data is shown
        
        // Enrich real rooms with FULL profile data (frontend needs detailed profile object)
        // listMyRooms does basic enrichment, but we want the full profile object for details
        allRooms = await Promise.all(allRooms.map(enrichRoomWithProfile));
        
        // Normalize all rooms for consistent display
        const normalizedRooms = allRooms.map(normalizeRoom);
        
        console.log(`[useRooms] Loaded ${normalizedRooms.length} rooms`);
        
        return normalizedRooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        return [];
      }
    },
    initialData: [],
    staleTime: 0, // Always refetch to ensure fresh data
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Ensure we check for updates on mount
  });
}