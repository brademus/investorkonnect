// Simple in-memory cache for deal details per session
const cache = new Map();

export function getCachedDeal(dealId) {
  if (!dealId) return null;
  return cache.get(dealId) || null;
}

export function setCachedDeal(dealId, deal) {
  if (!dealId || !deal) return;
  cache.set(dealId, deal);
}

export default { getCachedDeal, setCachedDeal };