import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Default placeholder deals that appear when no real data exists
 */
const DEFAULT_PLACEHOLDER_DEALS = [
  {
    id: 'placeholder-1',
    title: '123 Main Street',
    property_address: '123 Main Street',
    customer_name: 'John Smith',
    counterparty_name: 'John Smith',
    counterparty_role: 'investor',
    city: 'Phoenix',
    state: 'AZ',
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 1850,
    budget: 425000,
    contract_price: 425000,
    pipeline_stage: 'new_contract',
    created_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    contract_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 3,
    completed_tasks: 1
  },
  {
    id: 'placeholder-2',
    title: '456 Oak Avenue',
    property_address: '456 Oak Avenue',
    customer_name: 'Sarah Johnson',
    counterparty_name: 'Sarah Johnson',
    counterparty_role: 'agent',
    city: 'Scottsdale',
    state: 'AZ',
    bedrooms: 4,
    bathrooms: 3,
    square_feet: 2400,
    budget: 650000,
    contract_price: 650000,
    pipeline_stage: 'walkthrough_scheduled',
    created_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    walkthrough_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 2,
    completed_tasks: 3
  },
  {
    id: 'placeholder-3',
    title: '789 Desert Lane',
    property_address: '789 Desert Lane',
    customer_name: 'Mike Davis',
    counterparty_name: 'Mike Davis',
    counterparty_role: 'investor',
    city: 'Tempe',
    state: 'AZ',
    bedrooms: 5,
    bathrooms: 4,
    square_feet: 3200,
    budget: 825000,
    contract_price: 825000,
    pipeline_stage: 'evaluate_deal',
    created_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    evaluation_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 4,
    completed_tasks: 5
  }
];

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
 * Shows placeholder deals when no real data exists
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
        
        let allRooms = [...dbRooms, ...uniqueLocalRooms];
        
        // If no rooms exist at all, use placeholder deals
        if (allRooms.length === 0) {
          allRooms = DEFAULT_PLACEHOLDER_DEALS;
          console.log('[useRooms] No real data, using placeholder deals');
        }
        
        // Normalize all rooms for consistent display
        const normalizedRooms = allRooms.map(normalizeRoom);
        
        console.log(`[useRooms] Loaded ${dbRooms.length} from DB + ${uniqueLocalRooms.length} from local + ${allRooms.length === DEFAULT_PLACEHOLDER_DEALS.length ? DEFAULT_PLACEHOLDER_DEALS.length : 0} placeholders = ${normalizedRooms.length} total`);
        
        return normalizedRooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        
        // Final fallback to sessionStorage, or placeholders if empty
        const demoRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        const fallbackRooms = demoRooms.length > 0 ? demoRooms : DEFAULT_PLACEHOLDER_DEALS;
        return fallbackRooms.map(normalizeRoom);
      }
    },
    initialData: [],
    staleTime: 1000, // Consider data fresh for 1 second
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}