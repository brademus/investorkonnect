// Deal cache with in-memory Map + sessionStorage persistence for instant loads across navigations
const cache = new Map();

function ssGet(key) {
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch (_) {
    return null;
  }
}

function ssSet(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // ignore
  }
}

export function getCachedDeal(dealId) {
  if (!dealId) return null;
  const fromMem = cache.get(dealId);
  if (fromMem) return fromMem;
  const fromSS = ssGet(`dealCache:${dealId}`);
  if (fromSS) {
    cache.set(dealId, fromSS);
    return fromSS;
  }
  return null;
}

export function setCachedDeal(dealId, deal) {
  if (!dealId || !deal) return;
  cache.set(dealId, deal);
  ssSet(`dealCache:${dealId}`, deal);
}

export default { getCachedDeal, setCachedDeal };