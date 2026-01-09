/**
 * Helper to derive counterparty display name from existing data.
 * UI-only: reads from deal/room/profile data, never calls APIs or mutates DB.
 */

export function getCounterpartyDisplayName({ room, deal, currentUserRole }) {
  // First choice: explicit counterparty_name from room
  if (room?.counterparty_name && room.counterparty_name !== 'Unknown' && room.counterparty_name !== 'Loading...') {
    return room.counterparty_name;
  }
  
  // Second choice: try to derive from deal based on current user role
  if (deal && currentUserRole) {
    if (currentUserRole === 'investor' && deal.agent_id) {
      // Try to find agent name - check various fields
      if (deal.counterparty_name) return deal.counterparty_name;
      if (deal.agent_name) return deal.agent_name;
    } else if (currentUserRole === 'agent' && deal.investor_id) {
      // Try to find investor name
      if (deal.counterparty_name) return deal.counterparty_name;
      if (deal.investor_name) return deal.investor_name;
    }
  }
  
  // Third choice: fallback based on user role
  if (currentUserRole === 'investor') {
    return 'Agent';
  } else if (currentUserRole === 'agent') {
    return 'Investor';
  }
  
  // Last resort
  return 'Counterparty';
}