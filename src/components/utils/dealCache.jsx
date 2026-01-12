// Persistent + in-memory deal cache (stale-while-revalidate)
const memory = new Map();
const STORAGE_KEY = 'dealCache:v1';

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function loadStore() {
  if (typeof sessionStorage === 'undefined') return {};
  const raw = sessionStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function saveStore(store) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
    }
  } catch (_) {}
}

let store = loadStore();

export function getCachedDeal(dealId) {
  if (!dealId) return null;
  if (memory.has(dealId)) return memory.get(dealId);
  return store[dealId] || null;
}

export function setCachedDeal(dealId, deal) {
  if (!dealId || !deal) return;
  memory.set(dealId, deal);
  store[dealId] = deal;
  saveStore(store);
}

export function clearCachedDeal(dealId) {
  if (!dealId) return;
  memory.delete(dealId);
  if (store[dealId]) {
    delete store[dealId];
    saveStore(store);
  }
}

export function resetDealCache() {
  memory.clear();
  store = {};
  saveStore(store);
}

export default { getCachedDeal, setCachedDeal, clearCachedDeal, resetDealCache };