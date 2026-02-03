/**
 * TEMPLATE CACHE - Avoid re-fetching PDFs on every agreement generation
 * Templates are static - cache them for 1 hour
 */

const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch template with caching
 */
export async function fetchTemplate(url) {
  const cached = cache.get(url);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[templateCache] HIT:', url.substring(url.lastIndexOf('/') + 1));
    return cached.data;
  }
  
  console.log('[templateCache] MISS:', url.substring(url.lastIndexOf('/') + 1));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.status}`);
  }
  
  const data = await response.arrayBuffer();
  cache.set(url, { data, timestamp: Date.now() });
  
  // Cleanup old entries
  if (cache.size > 100) {
    const oldest = [...cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 50);
    oldest.forEach(([k]) => cache.delete(k));
  }
  
  return data;
}

/**
 * Pre-warm cache with common templates
 */
export async function prewarmTemplates(urls) {
  await Promise.all(urls.map(url => 
    fetchTemplate(url).catch(e => console.warn('[templateCache] Prewarm failed:', e.message))
  ));
}

/**
 * Clear cache (for testing)
 */
export function clearCache() {
  cache.clear();
}