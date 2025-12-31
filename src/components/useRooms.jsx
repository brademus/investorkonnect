import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getRoomsFromListMyRoomsResponse } from '@/components/utils/getRoomsFromListMyRooms';

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
 * Ensures consistency between Pipeline, Room/Messages, and other pages
 * NO VIRTUAL ROOM INJECTION - Database rooms only
 */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    staleTime: 10000, // Consider data fresh for 10 seconds
    gcTime: 1000 * 60 * 60, // Cache for 1 hour
    refetchOnMount: false, // Don't refetch on mount if we have cached data
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: 15000, // Poll every 15 seconds
    placeholderData: (prev) => prev, // Keep previous data while loading
    queryFn: async () => {
      try {
        // Load from backend function listMyRooms (DB-only)
        let dbRooms = [];
        try {
          const response = await base44.functions.invoke('listMyRooms');
          dbRooms = getRoomsFromListMyRoomsResponse(response);
        } catch (err) {
          console.log('[useRooms] Backend listMyRooms failed:', err.message);
        }
        
        // NO virtual room injection - orphan deals should appear in Pipeline only
        
        // Enrich with Counterparty Profiles
        const user = await base44.auth.me();
        let myProfileId = null;
        if (user) {
          // Email-first profile lookup (matches useCurrentProfile pattern)
          const emailLower = user.email.toLowerCase().trim();
          let profiles = await base44.entities.Profile.filter({ email: emailLower });
          
          // Fallback to user_id if not found by email
          if (!profiles || profiles.length === 0) {
            profiles = await base44.entities.Profile.filter({ user_id: user.id });
          }
          
          if (profiles.length > 0) {
            myProfileId = profiles[0].id;
          }
        }
        
        const allRooms = await Promise.all(dbRooms.map(room => enrichRoomWithProfile(room, myProfileId)));
        
        // Normalize
        const normalizedRooms = allRooms.map(normalizeRoom);
        
        console.log(`[useRooms] Loaded ${normalizedRooms.length} rooms (DB-only, no virtual injection)`);
        
        return normalizedRooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        return [];
      }
    },
  });
}