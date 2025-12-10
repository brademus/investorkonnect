import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

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
    title: room.title || room.deal_title || null,
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
 * Merges database rooms with client-side fetched deals for robustness
 */
export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      try {
        // 1. Load from backend function listMyRooms
        let dbRooms = [];
        try {
          const response = await base44.functions.invoke('listMyRooms');
          if (response.data && response.data.items) {
            dbRooms = response.data.items;
          }
        } catch (err) {
          console.log('[useRooms] Backend listMyRooms failed:', err.message);
        }
        
        // 2. Client-Side Deal Enrichment (Backup for Backend)
        // This ensures that even if backend inference fails, we patch it here
        try {
            const user = await base44.auth.me();
            if (user) {
                const profiles = await base44.entities.Profile.filter({ user_id: user.id });
                if (profiles.length > 0) {
                    const myProfileId = profiles[0].id;
                    
                    // Fetch all deals for this user
                    const myDeals = await base44.entities.Deal.filter({ investor_id: myProfileId });
                    
                    // Identify the "Active" deal (latest one) for inference
                    const activeDeals = myDeals
                        .filter(d => d.status === 'active' || d.status === 'new_deal_under_contract')
                        .sort((a,b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
                    
                    const latestDeal = activeDeals[0];

                    dbRooms = dbRooms.map(r => {
                        // Logic: If room already has robust data, keep it.
                        // Otherwise, try to fill holes.
                        
                        let dealToUse = null;

                        // Case A: Room has explicit deal_id -> Find it in myDeals
                        if (r.deal_id) {
                            dealToUse = myDeals.find(d => d.id === r.deal_id);
                        }
                        
                        // Case B: Room is "Active" but has no deal -> Infer latest active deal
                        // Only if I am the investor
                        if (!dealToUse && !r.deal_id && r.investorId === myProfileId && latestDeal) {
                            dealToUse = latestDeal;
                        }

                        if (dealToUse) {
                            return {
                                ...r,
                                deal_title: dealToUse.title, // Title usually contains name or address
                                property_address: dealToUse.property_address,
                                budget: dealToUse.purchase_price,
                                pipeline_stage: dealToUse.pipeline_stage,
                                suggested_deal_id: dealToUse.id, // Ensure lock-in button works
                                deal_assigned_agent_id: dealToUse.agent_id,
                                contract_date: dealToUse.key_dates?.closing_date,
                                city: dealToUse.city,
                                state: dealToUse.state
                            };
                        }
                        
                        return r;
                    });
                }
            }
        } catch (e) {
            console.error("[useRooms] Client-side enrichment failed:", e);
        }

        // 3. Enrich with Counterparty Profiles
        let allRooms = [...dbRooms];
        allRooms = await Promise.all(allRooms.map(enrichRoomWithProfile));
        
        // 4. Normalize
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
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}