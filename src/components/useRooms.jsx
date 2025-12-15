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
    pipeline_stage: room.pipeline_stage || (room.deal_id ? 'new_deal_under_contract' : null),
    deal_title: room.deal_title || room.title || null,
    // Last message already fetched by backend
    last_message: room.last_message,
    last_message_text: room.last_message_text,
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
    staleTime: 4000,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: 8000, // Poll every 8 seconds (smooth updates)
    placeholderData: (prev) => prev,
    queryFn: async () => {
      try {
        // 1. Load from backend function listMyRooms
        let dbRooms = [];
        try {
          const response = await base44.functions.invoke('listMyRooms');
          dbRooms = getRoomsFromListMyRoomsResponse(response);
        } catch (err) {
          console.log('[useRooms] Backend listMyRooms failed:', err.message);
        }
        
        // 2. Client-Side Deal Enrichment (Backup for Backend)
        // This ensures that even if backend inference fails, we patch it here
        try {
            const user = await base44.auth.me();
            if (user) {
                // Email-first profile lookup (matches useCurrentProfile pattern)
                const emailLower = user.email.toLowerCase().trim();
                let profiles = await base44.entities.Profile.filter({ email: emailLower });
                
                // Fallback to user_id if not found by email
                if (!profiles || profiles.length === 0) {
                  profiles = await base44.entities.Profile.filter({ user_id: user.id });
                }
                
                if (profiles.length > 0) {
                    const myProfileId = profiles[0].id;
                    
                    // Fetch all deals for this user
                    const myDeals = await base44.entities.Deal.filter({ investor_id: myProfileId });
                    
                    // Identify the "Active" deal (latest one) for inference
                    // Broader status check to catch more deals
                    const activeDeals = myDeals
                        .filter(d => !d.status || ['active', 'new_deal_under_contract', 'under_contract', 'draft'].includes(d.status))
                        .sort((a,b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
                    
                    const latestDeal = activeDeals[0];

                    // 1. Enrich existing rooms with deal data
                    dbRooms = dbRooms.map(r => {
                        let dealToUse = null;

                        // Case A: Room has explicit deal_id -> Find it in myDeals
                        if (r.deal_id) {
                            dealToUse = myDeals.find(d => d.id === r.deal_id);
                        }
                        
                        // Case B: Inference only if no explicit deal_id (No link OR Broken link)
                        if (!r.deal_id && !dealToUse && r.investorId === myProfileId && latestDeal) {
                            dealToUse = latestDeal;
                        }

                        if (dealToUse) {
                            return {
                                ...r,
                                deal_id: dealToUse.id, // Ensure deal_id is set
                                deal_title: dealToUse.title,
                                property_address: dealToUse.property_address,
                                budget: dealToUse.purchase_price,
                                pipeline_stage: dealToUse.pipeline_stage,
                                suggested_deal_id: dealToUse.id,
                                deal_assigned_agent_id: dealToUse.agent_id,
                                closing_date: dealToUse.key_dates?.closing_date,
                                city: dealToUse.city,
                                state: dealToUse.state,
                                county: dealToUse.county,
                                zip: dealToUse.zip,
                                status: dealToUse.status
                            };
                        }
                        return r;
                    });

                    // 2. Clean up exploration rooms for deals with locked-in agents
                    // Remove rooms where deal has agent_id but room has suggested_deal_id
                    dbRooms = dbRooms.filter(r => {
                        // If room has suggested_deal_id (exploration room)
                        if (r.suggested_deal_id && !r.deal_id) {
                            const deal = myDeals.find(d => d.id === r.suggested_deal_id);
                            // Keep only if deal doesn't have locked-in agent
                            return deal && !deal.agent_id;
                        }
                        return true;
                    });

                    // 3. Inject Orphan Deal if missing
                    // Check if we have an active deal without an agent that isn't represented in the rooms list
                    if (latestDeal && !latestDeal.agent_id) {
                        const isRepresented = dbRooms.some(r => 
                            r.deal_id === latestDeal.id || 
                            r.suggested_deal_id === latestDeal.id ||
                            (r.is_orphan && r.id === `virtual_${latestDeal.id}`)
                        );

                        if (!isRepresented) {
                            console.log("[useRooms] Injecting client-side orphan deal:", latestDeal.id);
                            dbRooms.push({
                                id: `virtual_${latestDeal.id}`,
                                deal_id: latestDeal.id,
                                title: latestDeal.title,
                                property_address: latestDeal.property_address,
                                city: latestDeal.city,
                                state: latestDeal.state,
                                budget: latestDeal.purchase_price,
                                pipeline_stage: latestDeal.pipeline_stage || 'new_deal_under_contract',
                                created_date: latestDeal.created_date,
                                counterparty_name: 'No Agent Selected',
                                counterparty_role: 'none',
                                is_orphan: true
                            });
                            
                            // Sort again to ensure it appears at top if new
                            dbRooms.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[useRooms] Client-side enrichment failed:", e);
        }

        // 3. Enrich with Counterparty Profiles
        let allRooms = [...dbRooms];
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
        allRooms = await Promise.all(allRooms.map(room => enrichRoomWithProfile(room, myProfileId)));
        
        // 4. Normalize (sync - backend already has messages)
        const normalizedRooms = allRooms.map(normalizeRoom);
        
        console.log(`[useRooms] Loaded ${normalizedRooms.length} rooms`);
        
        return normalizedRooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        return [];
      }
    },
  });
}