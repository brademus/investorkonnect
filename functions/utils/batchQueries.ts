/**
 * BATCH QUERY UTILITIES - Parallel data fetching
 * Reduces sequential API calls from 10+ down to 1-2
 */

/**
 * Fetch multiple entities in parallel with deduplication
 */
export async function batchFetch(base44, queries) {
  const results = await Promise.all(
    queries.map(async ({ entity, filter, sort, limit }) => {
      try {
        return await base44.asServiceRole.entities[entity].filter(filter || {}, sort, limit);
      } catch (e) {
        console.warn(`[batchFetch] ${entity} failed:`, e.message);
        return [];
      }
    })
  );
  
  return results;
}

/**
 * Get deal with all related data in 1-2 parallel queries
 */
export async function getDealWithRelations(base44, dealId) {
  const [deals, rooms, agreements, counters, invites] = await Promise.all([
    base44.asServiceRole.entities.Deal.filter({ id: dealId }),
    base44.asServiceRole.entities.Room.filter({ deal_id: dealId }),
    base44.asServiceRole.entities.LegalAgreement.filter({ deal_id: dealId }, '-created_date', 10),
    base44.asServiceRole.entities.CounterOffer.filter({ deal_id: dealId, status: 'pending' }),
    base44.asServiceRole.entities.DealInvite.filter({ deal_id: dealId })
  ]);
  
  const deal = deals[0] || null;
  
  // Get unique profile IDs
  const profileIds = new Set();
  if (deal?.investor_id) profileIds.add(deal.investor_id);
  rooms.forEach(r => {
    if (r.investorId) profileIds.add(r.investorId);
    if (r.agentId) profileIds.add(r.agentId);
  });
  
  // Batch fetch profiles
  const profiles = await Promise.all(
    [...profileIds].map(id => 
      base44.asServiceRole.entities.Profile.filter({ id }).then(p => p[0]).catch(() => null)
    )
  );
  
  const profileMap = {};
  profiles.forEach(p => { if (p) profileMap[p.id] = p; });
  
  return { deal, rooms, agreements, counters, invites, profiles: profileMap };
}

/**
 * Get room with all related data in 1 parallel query
 */
export async function getRoomWithRelations(base44, roomId) {
  const [rooms, agreements, counters] = await Promise.all([
    base44.asServiceRole.entities.Room.filter({ id: roomId }),
    base44.asServiceRole.entities.LegalAgreement.filter({ room_id: roomId }, '-created_date', 5),
    base44.asServiceRole.entities.CounterOffer.filter({ room_id: roomId, status: 'pending' })
  ]);
  
  const room = rooms[0] || null;
  if (!room) return null;
  
  // Batch fetch profiles + deal
  const [deal, investorProfile, agentProfile] = await Promise.all([
    base44.asServiceRole.entities.Deal.filter({ id: room.deal_id }).then(d => d[0]).catch(() => null),
    base44.asServiceRole.entities.Profile.filter({ id: room.investorId }).then(p => p[0]).catch(() => null),
    base44.asServiceRole.entities.Profile.filter({ id: room.agentId }).then(p => p[0]).catch(() => null)
  ]);
  
  return { room, deal, investorProfile, agentProfile, agreements, counters };
}

/**
 * Cache wrapper with TTL
 */
const cache = new Map();
const CACHE_TTL = 10000; // 10 seconds

export function withCache(key, fn, ttl = CACHE_TTL) {
  return async (...args) => {
    const cacheKey = `${key}_${JSON.stringify(args)}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value;
    }
    
    const value = await fn(...args);
    cache.set(cacheKey, { value, timestamp: Date.now() });
    
    // Cleanup old entries
    if (cache.size > 1000) {
      const oldest = [...cache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 500);
      oldest.forEach(([k]) => cache.delete(k));
    }
    
    return value;
  };
}