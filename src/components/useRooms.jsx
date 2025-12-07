import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Placeholder deals for INVESTORS (showing matched AGENTS as counterparties)
 */
const INVESTOR_PLACEHOLDER_DEALS = [
  {
    id: 'demo-room-1',
    // Room identifiers
    investorId: 'demo-investor-1',
    agentId: 'demo-agent-1',
    
    // Property details (for Pipeline)
    title: '2847 E Camelback Road',
    property_address: '2847 E Camelback Road',
    city: 'Phoenix',
    state: 'AZ',
    bedrooms: 4,
    bathrooms: 3,
    square_feet: 2850,
    budget: 895000,
    contract_price: 895000,
    
    // Deal progress (for Pipeline)
    pipeline_stage: 'new_contract',
    created_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    contract_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 4,
    completed_tasks: 2,
    
    // Counterparty info (for Messages/Rooms)
    counterparty_name: 'Michael Chen',
    counterparty_role: 'agent',
    counterparty_email: 'michael.chen@phoenixrealty.com',
    counterparty_company: 'Phoenix Premium Realty',
    counterparty_phone: '(602) 555-0147',
    customer_name: 'Michael Chen',
    
    // Full profile for detailed views
    counterparty_profile: {
      id: 'demo-agent-1',
      full_name: 'Michael Chen',
      email: 'michael.chen@phoenixrealty.com',
      user_role: 'agent',
      company: 'Phoenix Premium Realty',
      phone: '(602) 555-0147',
      markets: ['Phoenix', 'Scottsdale', 'Paradise Valley'],
      agent: {
        brokerage: 'Phoenix Premium Realty',
        license_number: 'AZ-12345678',
        experience_years: 12,
        specialties: ['Luxury Residential', 'Investment Properties']
      }
    }
  },
  {
    id: 'demo-room-2',
    investorId: 'demo-investor-2',
    agentId: 'demo-agent-2',
    
    title: '5621 N Scottsdale Road',
    property_address: '5621 N Scottsdale Road',
    city: 'Scottsdale',
    state: 'AZ',
    bedrooms: 5,
    bathrooms: 4.5,
    square_feet: 3600,
    budget: 1250000,
    contract_price: 1250000,
    
    pipeline_stage: 'walkthrough_scheduled',
    created_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    walkthrough_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 3,
    completed_tasks: 5,
    
    counterparty_name: 'Sarah Martinez',
    counterparty_role: 'agent',
    counterparty_email: 'sarah.martinez@luxuryaz.com',
    counterparty_company: 'Luxury Arizona Properties',
    counterparty_phone: '(480) 555-0289',
    customer_name: 'Sarah Martinez',
    
    counterparty_profile: {
      id: 'demo-agent-2',
      full_name: 'Sarah Martinez',
      email: 'sarah.martinez@luxuryaz.com',
      user_role: 'agent',
      company: 'Luxury Arizona Properties',
      phone: '(480) 555-0289',
      markets: ['Scottsdale', 'Paradise Valley', 'Fountain Hills'],
      agent: {
        brokerage: 'Luxury Arizona Properties',
        license_number: 'AZ-87654321',
        experience_years: 8,
        specialties: ['Luxury Homes', 'Golf Course Properties']
      }
    }
  },
  {
    id: 'demo-room-3',
    investorId: 'demo-investor-3',
    agentId: 'demo-agent-3',
    
    title: '1234 W University Drive',
    property_address: '1234 W University Drive',
    city: 'Tempe',
    state: 'AZ',
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 1650,
    budget: 485000,
    contract_price: 485000,
    
    pipeline_stage: 'evaluate_deal',
    created_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    evaluation_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 2,
    completed_tasks: 7,
    
    counterparty_name: 'David Thompson',
    counterparty_role: 'agent',
    counterparty_email: 'david.thompson@desertinvest.com',
    counterparty_company: 'Desert Investment Realty',
    counterparty_phone: '(480) 555-0312',
    customer_name: 'David Thompson',
    
    counterparty_profile: {
      id: 'demo-agent-3',
      full_name: 'David Thompson',
      email: 'david.thompson@desertinvest.com',
      user_role: 'agent',
      company: 'Desert Investment Realty',
      phone: '(480) 555-0312',
      markets: ['Tempe', 'Mesa', 'Gilbert'],
      agent: {
        brokerage: 'Desert Investment Realty',
        license_number: 'AZ-45678912',
        experience_years: 15,
        specialties: ['Investment Properties', 'Multi-Family']
      }
    }
  },
  {
    id: 'demo-room-4',
    investorId: 'demo-investor-4',
    agentId: 'demo-agent-4',
    
    title: '8945 E Shea Boulevard',
    property_address: '8945 E Shea Boulevard',
    city: 'Scottsdale',
    state: 'AZ',
    bedrooms: 4,
    bathrooms: 3.5,
    square_feet: 3100,
    budget: 975000,
    contract_price: 975000,
    
    pipeline_stage: 'marketing',
    created_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    marketing_start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 1,
    completed_tasks: 9,
    
    counterparty_name: 'Jennifer Wu',
    counterparty_role: 'agent',
    counterparty_email: 'jennifer.wu@eliterealty.com',
    counterparty_company: 'Elite Realty Partners',
    counterparty_phone: '(602) 555-0456',
    customer_name: 'Jennifer Wu',
    
    counterparty_profile: {
      id: 'demo-agent-4',
      full_name: 'Jennifer Wu',
      email: 'jennifer.wu@eliterealty.com',
      user_role: 'agent',
      company: 'Elite Realty Partners',
      phone: '(602) 555-0456',
      markets: ['Scottsdale', 'Phoenix', 'Cave Creek'],
      agent: {
        brokerage: 'Elite Realty Partners',
        license_number: 'AZ-78912345',
        experience_years: 10,
        specialties: ['Luxury Estates', 'New Construction']
      }
    }
  },
  {
    id: 'demo-room-5',
    investorId: 'demo-investor-5',
    agentId: 'demo-agent-5',
    
    title: '3456 N Central Avenue',
    property_address: '3456 N Central Avenue',
    city: 'Phoenix',
    state: 'AZ',
    bedrooms: 6,
    bathrooms: 5,
    square_feet: 4200,
    budget: 1650000,
    contract_price: 1650000,
    
    pipeline_stage: 'closing',
    created_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    closing_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 1,
    completed_tasks: 15,
    
    counterparty_name: 'Robert Singh',
    counterparty_role: 'agent',
    counterparty_email: 'robert.singh@prestigeproperties.com',
    counterparty_company: 'Prestige Properties Group',
    counterparty_phone: '(602) 555-0789',
    customer_name: 'Robert Singh',
    
    counterparty_profile: {
      id: 'demo-agent-5',
      full_name: 'Robert Singh',
      email: 'robert.singh@prestigeproperties.com',
      user_role: 'agent',
      company: 'Prestige Properties Group',
      phone: '(602) 555-0789',
      markets: ['Phoenix', 'Arcadia', 'Biltmore'],
      agent: {
        brokerage: 'Prestige Properties Group',
        license_number: 'AZ-23456789',
        experience_years: 18,
        specialties: ['Luxury Homes', 'Estate Properties', 'Historic Homes']
      }
    }
  }
];

/**
 * Placeholder deals for AGENTS (showing matched INVESTORS as counterparties)
 */
const AGENT_PLACEHOLDER_DEALS = [
  {
    id: 'demo-room-1',
    investorId: 'demo-investor-1',
    agentId: 'demo-agent-1',
    
    title: '2847 E Camelback Road',
    property_address: '2847 E Camelback Road',
    city: 'Phoenix',
    state: 'AZ',
    bedrooms: 4,
    bathrooms: 3,
    square_feet: 2850,
    budget: 895000,
    contract_price: 895000,
    
    pipeline_stage: 'new_contract',
    created_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    contract_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 4,
    completed_tasks: 2,
    
    counterparty_name: 'James Mitchell',
    counterparty_role: 'investor',
    counterparty_email: 'james.mitchell@capitalgroup.com',
    counterparty_company: 'Mitchell Capital Group',
    counterparty_phone: '(602) 555-1001',
    customer_name: 'James Mitchell',
    
    counterparty_profile: {
      id: 'demo-investor-1',
      full_name: 'James Mitchell',
      email: 'james.mitchell@capitalgroup.com',
      user_role: 'investor',
      company: 'Mitchell Capital Group',
      phone: '(602) 555-1001',
      markets: ['Phoenix', 'Scottsdale', 'Paradise Valley'],
      investor: {
        company_name: 'Mitchell Capital Group',
        investment_focus: 'Luxury Residential',
        portfolio_size: '15-20 properties',
        preferred_strategies: ['Buy and Hold', 'Fix and Flip']
      }
    }
  },
  {
    id: 'demo-room-2',
    investorId: 'demo-investor-2',
    agentId: 'demo-agent-2',
    
    title: '5621 N Scottsdale Road',
    property_address: '5621 N Scottsdale Road',
    city: 'Scottsdale',
    state: 'AZ',
    bedrooms: 5,
    bathrooms: 4.5,
    square_feet: 3600,
    budget: 1250000,
    contract_price: 1250000,
    
    pipeline_stage: 'walkthrough_scheduled',
    created_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    walkthrough_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 3,
    completed_tasks: 5,
    
    counterparty_name: 'Lisa Zhang',
    counterparty_role: 'investor',
    counterparty_email: 'lisa.zhang@zhanginvestments.com',
    counterparty_company: 'Zhang Investment Partners',
    counterparty_phone: '(480) 555-2002',
    customer_name: 'Lisa Zhang',
    
    counterparty_profile: {
      id: 'demo-investor-2',
      full_name: 'Lisa Zhang',
      email: 'lisa.zhang@zhanginvestments.com',
      user_role: 'investor',
      company: 'Zhang Investment Partners',
      phone: '(480) 555-2002',
      markets: ['Scottsdale', 'Paradise Valley', 'Fountain Hills'],
      investor: {
        company_name: 'Zhang Investment Partners',
        investment_focus: 'Multi-Family and Commercial',
        portfolio_size: '25+ properties',
        preferred_strategies: ['Value-Add', 'Development']
      }
    }
  },
  {
    id: 'demo-room-3',
    investorId: 'demo-investor-3',
    agentId: 'demo-agent-3',
    
    title: '1234 W University Drive',
    property_address: '1234 W University Drive',
    city: 'Tempe',
    state: 'AZ',
    bedrooms: 3,
    bathrooms: 2,
    square_feet: 1650,
    budget: 485000,
    contract_price: 485000,
    
    pipeline_stage: 'evaluate_deal',
    created_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    evaluation_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 2,
    completed_tasks: 7,
    
    counterparty_name: 'Marcus Johnson',
    counterparty_role: 'investor',
    counterparty_email: 'marcus.johnson@johnsonrealty.com',
    counterparty_company: 'Johnson Realty Investments',
    counterparty_phone: '(480) 555-3003',
    customer_name: 'Marcus Johnson',
    
    counterparty_profile: {
      id: 'demo-investor-3',
      full_name: 'Marcus Johnson',
      email: 'marcus.johnson@johnsonrealty.com',
      user_role: 'investor',
      company: 'Johnson Realty Investments',
      phone: '(480) 555-3003',
      markets: ['Tempe', 'Mesa', 'Gilbert'],
      investor: {
        company_name: 'Johnson Realty Investments',
        investment_focus: 'Single Family Rentals',
        portfolio_size: '30+ properties',
        preferred_strategies: ['Buy and Hold', 'BRRRR']
      }
    }
  },
  {
    id: 'demo-room-4',
    investorId: 'demo-investor-4',
    agentId: 'demo-agent-4',
    
    title: '8945 E Shea Boulevard',
    property_address: '8945 E Shea Boulevard',
    city: 'Scottsdale',
    state: 'AZ',
    bedrooms: 4,
    bathrooms: 3.5,
    square_feet: 3100,
    budget: 975000,
    contract_price: 975000,
    
    pipeline_stage: 'marketing',
    created_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    marketing_start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 1,
    completed_tasks: 9,
    
    counterparty_name: 'Patricia Rodriguez',
    counterparty_role: 'investor',
    counterparty_email: 'patricia.rodriguez@rodriguezholdings.com',
    counterparty_company: 'Rodriguez Property Holdings',
    counterparty_phone: '(602) 555-4004',
    customer_name: 'Patricia Rodriguez',
    
    counterparty_profile: {
      id: 'demo-investor-4',
      full_name: 'Patricia Rodriguez',
      email: 'patricia.rodriguez@rodriguezholdings.com',
      user_role: 'investor',
      company: 'Rodriguez Property Holdings',
      phone: '(602) 555-4004',
      markets: ['Scottsdale', 'Phoenix', 'Cave Creek'],
      investor: {
        company_name: 'Rodriguez Property Holdings',
        investment_focus: 'Luxury Flips and New Construction',
        portfolio_size: '10-15 properties',
        preferred_strategies: ['Fix and Flip', 'New Development']
      }
    }
  },
  {
    id: 'demo-room-5',
    investorId: 'demo-investor-5',
    agentId: 'demo-agent-5',
    
    title: '3456 N Central Avenue',
    property_address: '3456 N Central Avenue',
    city: 'Phoenix',
    state: 'AZ',
    bedrooms: 6,
    bathrooms: 5,
    square_feet: 4200,
    budget: 1650000,
    contract_price: 1650000,
    
    pipeline_stage: 'closing',
    created_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updated_date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    closing_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    open_tasks: 1,
    completed_tasks: 15,
    
    counterparty_name: 'Thomas Anderson',
    counterparty_role: 'investor',
    counterparty_email: 'thomas.anderson@andersonventures.com',
    counterparty_company: 'Anderson Ventures LLC',
    counterparty_phone: '(602) 555-5005',
    customer_name: 'Thomas Anderson',
    
    counterparty_profile: {
      id: 'demo-investor-5',
      full_name: 'Thomas Anderson',
      email: 'thomas.anderson@andersonventures.com',
      user_role: 'investor',
      company: 'Anderson Ventures LLC',
      phone: '(602) 555-5005',
      markets: ['Phoenix', 'Arcadia', 'Biltmore'],
      investor: {
        company_name: 'Anderson Ventures LLC',
        investment_focus: 'Estate Properties and Historic Homes',
        portfolio_size: '20+ properties',
        preferred_strategies: ['Buy and Hold', 'Historic Renovation']
      }
    }
  }
];

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
        
        // If no rooms exist at all, use role-appropriate placeholder deals
        if (allRooms.length === 0) {
          allRooms = userRole === 'agent' ? AGENT_PLACEHOLDER_DEALS : INVESTOR_PLACEHOLDER_DEALS;
          console.log(`[useRooms] No real data, using ${userRole} placeholder deals`);
        } else {
          // Enrich real rooms with profile data
          allRooms = await Promise.all(allRooms.map(enrichRoomWithProfile));
        }
        
        // Normalize all rooms for consistent display
        const normalizedRooms = allRooms.map(normalizeRoom);
        
        console.log(`[useRooms] Loaded ${dbRooms.length} from DB + ${uniqueLocalRooms.length} from local + ${allRooms === INVESTOR_PLACEHOLDER_DEALS || allRooms === AGENT_PLACEHOLDER_DEALS ? allRooms.length : 0} placeholders = ${normalizedRooms.length} total for ${userRole}`);
        
        return normalizedRooms;
      } catch (error) {
        console.error('[useRooms] Error loading rooms:', error);
        
        // Final fallback to sessionStorage, or investor placeholders if empty
        const demoRooms = JSON.parse(sessionStorage.getItem('demo_rooms') || '[]');
        const fallbackRooms = demoRooms.length > 0 ? demoRooms : INVESTOR_PLACEHOLDER_DEALS;
        return fallbackRooms.map(normalizeRoom);
      }
    },
    initialData: [],
    staleTime: 1000, // Consider data fresh for 1 second
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}