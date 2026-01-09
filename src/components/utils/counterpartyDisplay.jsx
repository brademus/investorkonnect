/**
 * Helper to derive counterparty display name from existing data.
 * UI-only: reads from deal/room/profile data, never calls APIs or mutates DB.
 */

export function getCounterpartyDisplayName({ room, deal, currentUserRole }) {
  // First choice: explicit counterparty_name from room
  if (room?.counterparty_name && room.counterparty_name !== 'Unknown' && room.counterparty_name !== 'Loading...' && room.counterparty_name !== 'Investor' && room.counterparty_name !== 'Agent') {
    return room.counterparty_name;
  }
  
  // Second choice: try to derive from deal based on current user role
  if (deal && currentUserRole) {
    if (currentUserRole === 'investor') {
      // Agent view - find investor name from deal or room
      if (room?.counterparty_name && room.counterparty_name !== 'Unknown') return room.counterparty_name;
    } else if (currentUserRole === 'agent') {
      // Investor view - find investor name from deal or room
      if (room?.counterparty_name && room.counterparty_name !== 'Unknown') return room.counterparty_name;
    }
  }
  
  // Last resort: return null so parent component can use a safe fallback
  return null;
}