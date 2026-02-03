/**
 * DOCUSIGN CONNECTION CACHE - Avoid repeated DB lookups
 * Connections are semi-static - cache for 5 minutes
 */

let cachedConnection = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Get DocuSign connection with caching
 */
export async function getDocuSignConnection(base44) {
  const now = Date.now();
  
  if (cachedConnection && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[docusignCache] HIT');
    return cachedConnection;
  }
  
  console.log('[docusignCache] MISS - fetching from DB');
  const connections = await base44.asServiceRole.entities.DocuSignConnection.list();
  const conn = connections?.[0] || null;
  
  if (conn) {
    cachedConnection = conn;
    cacheTimestamp = now;
  }
  
  return conn;
}

/**
 * Invalidate cache (call after token refresh)
 */
export function invalidateDocuSignCache() {
  cachedConnection = null;
  cacheTimestamp = 0;
  console.log('[docusignCache] Invalidated');
}

/**
 * Update cache without DB round-trip
 */
export function updateDocuSignCache(connection) {
  cachedConnection = connection;
  cacheTimestamp = Date.now();
}