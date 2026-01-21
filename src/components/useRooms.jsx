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
        
        // Filter invalid/legacy rooms defensively (must have a deal). Allow pipeline-only "orphan" entries for investors.
        const safeRooms = rooms.filter(r => r && r.deal_id);
        
        // console.log(`[useRooms] Loaded ${rooms.length} enriched rooms (server-side); using ${safeRooms.length} safe rooms`);
        
        try {
          // Single-pass deduplication by deal_id only (most reliable)
          // Keep the most relevant room: signed > accepted > requested > others, then latest update
          const score = (r) => {
            if (r?.agreement_status === 'fully_signed' || r?.is_fully_signed) return 4;
            if (r?.request_status === 'signed') return 3;
            if (r?.request_status === 'accepted') return 2;
            if (r?.request_status === 'requested') return 1;
            if (r?.request_status === 'rejected') return -1;
            return 0;
          };
          
          const byDeal = new Map();
          for (const r of safeRooms) {
            // Skip canceled deals entirely
            if (r?.pipeline_stage === 'canceled') continue;
            
            const normId = String(r?.deal_id || '').trim();
            if (!normId) continue;
            
            const prev = byDeal.get(normId);
            if (!prev) {
              byDeal.set(normId, r);
              continue;
            }
            
            // Compare: higher score wins, ties go to most recent
            const sA = score(r);
            const sB = score(prev);
            const tA = new Date(r.updated_date || r.created_date || 0).getTime();
            const tB = new Date(prev.updated_date || prev.created_date || 0).getTime();
            
            if (sA > sB || (sA === sB && tA > tB)) {
              byDeal.set(normId, r);
            }
          }
          
          const deduped = Array.from(byDeal.values());

          // Secondary collapse by canonical address signature to eliminate dup rooms for same property
          const norm = (v) => (v ?? '').toString().trim().toLowerCase();
          const cleanAddr = (s) => norm(s)
            .replace(/\b(apt|apartment|unit|ste|suite|#)\b.*$/i, '')
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 80);
          const makeSig = (r) => [
            cleanAddr(r?.property_address || r?.deal_title || r?.title || ''),
            norm(r?.city),
            norm(r?.state),
            String(r?.zip || '').toString().slice(0, 5),
            Number(Math.round(Number(r?.budget || 0)))
          ].join('|');

          const bySig = new Map();
          for (const r of deduped) {
            const k = makeSig(r);
            const prev = bySig.get(k);
            if (!prev) { bySig.set(k, r); continue; }
            const sA = score(r), sB = score(prev);
            const tA = new Date(r.updated_date || r.created_date || 0).getTime();
            const tB = new Date(prev.updated_date || prev.created_date || 0).getTime();
            if (sA > sB || (sA === sB && tA > tB)) bySig.set(k, r);
          }

          const finalList = Array.from(bySig.values());
          return finalList.sort((a, b) => {
            const dateA = new Date(a?.updated_date || a?.created_date || 0);
            const dateB = new Date(b?.updated_date || b?.created_date || 0);
            return dateB - dateA; // Most recent first
          });
        } catch (e) {
          console.error('[useRooms] dedupe error:', e);
          return safeRooms.filter(r => r?.pipeline_stage !== 'canceled');
        }
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        return [];
      }
    },
  });
}