import { base44 } from "@/api/base44Client";
import { getRoomsFromListMyRoomsResponse } from "@/components/utils/getRoomsFromListMyRooms";

/**
 * Get or create a deal room for a specific deal + agent combination.
 * Checks if a room already exists, otherwise creates a new one.
 * 
 * @param {Object} params
 * @param {string} params.dealId - Deal ID
 * @param {string} params.agentProfileId - Agent's profile ID
 * @returns {Promise<string>} - Room ID
 */
export async function getOrCreateDealRoom({ dealId, agentProfileId }) {
  if (!dealId || !agentProfileId) {
    throw new Error("dealId and agentProfileId are required");
  }

  // Check for existing room
  const roomsResponse = await base44.functions.invoke('listMyRooms');
  const rooms = getRoomsFromListMyRoomsResponse(roomsResponse);
  
  const existingRoom = rooms.find(room => 
    (room.deal_id === dealId || room.suggested_deal_id === dealId) && 
    (
      room.agentId === agentProfileId || 
      room.agent_id === agentProfileId ||
      room.counterparty_profile_id === agentProfileId ||
      room.counterparty_profile?.id === agentProfileId
    )
  );
  
  if (existingRoom) {
    return existingRoom.id;
  }
  
  // Create new room
  const response = await base44.functions.invoke('createDealRoom', { 
    deal_id: dealId,
    counterparty_profile_id: agentProfileId 
  });
  
  if (!response.data?.room?.id) {
    throw new Error("Failed to create room");
  }
  
  return response.data.room.id;
}