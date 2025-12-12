/**
 * Normalizes listMyRooms response shape
 * Backend may return either { data: { items: [...] } } or { data: { rooms: [...] } }
 * This helper ensures consistent access across the app
 */
export function getRoomsFromListMyRoomsResponse(res) {
  return res?.data?.items ?? res?.data?.rooms ?? [];
}