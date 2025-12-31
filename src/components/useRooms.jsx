import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Enrich room with full profile data from matched counterparty
 */
async function enrichRoomWithProfile(room, myProfileId) {
  try {
    // Determine which profile ID to fetch - exclude current user
    let counterpartyId;
    if (room.agentId === myProfileId) {
      counterpartyId = room.investorId;
    } else if (room.investorId === myProfileId) {
      counterpartyId = room.agentId;
    } else {
      counterpartyId = room.agentId || room.investorId;
    }
    
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
    title: room.title || room.deal_title || null,
    property_address: room.property_address || null,
    customer_name: room.customer_name || room.counterparty_name || null,
    budget: room.budget || room.contract_price || null,
    pipeline_stage: room.pipeline_stage || (room.deal_id ? 'new_listings' : null),
    deal_title: room.deal_title || room.title || null,
    // Status tracking - use request_status + agreement_status for lock-in
    is_orphan: !room.agentId && !room.agent_id,
    has_agent_locked_in: room.request_status === 'accepted' || room.request_status === 'signed' || room.agreement_status === 'fully_signed',
    // Last message already fetched by backend
    last_message: room.last_message,
    last_message_text: room.last_message_text,
  };
}

/**
 * Shared hook for loading rooms/deals across all pages
 * Uses server-side enriched endpoint - NO client N+1 queries
 * NO VIRTUAL ROOM INJECTION - Database rooms only
 */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    staleTime: 1000 * 30, // Consider data fresh for 30 seconds
    gcTime: 1000 * 60 * 10, // Cache for 10 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 1000 * 30, // Poll every 30 seconds (reduced from 15)
    refetchIntervalInBackground: false, // Pause when tab hidden
    placeholderData: (prev) => prev, // Keep previous data while loading
    queryFn: async () => {
      try {
        // Use server-side enriched endpoint - eliminates N+1 profile fetches
        const response = await base44.functions.invoke('listMyRoomsEnriched');
        const rooms = response.data?.rooms || [];
        
        console.log(`[useRooms] Loaded ${rooms.length} enriched rooms (server-side, no N+1)`);
        
        return rooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        return [];
      }
    },
  });
}