/**
 * Agent Scoring & Ranking Algorithm
 * Used by SelectAgent page to rank agents for a deal.
 */

// ─── County Centroids (lazy-loaded from CSV) ───

let _centroidsCache = null;
const _centroidsPromise = { ref: null };

const FIPS_TO_STATE = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
  "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
  "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
  "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
  "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
  "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
  "54":"WV","55":"WI","56":"WY","72":"PR"
};

async function loadCentroids() {
  if (_centroidsCache) return _centroidsCache;
  if (_centroidsPromise.ref) return _centroidsPromise.ref;

  _centroidsPromise.ref = (async () => {
    try {
      const resp = await fetch("https://gist.githubusercontent.com/russellsamora/12be4f9f574e92413ea3f92ce1bc58e6/raw/");
      const text = await resp.text();
      const map = {};
      const lines = text.trim().split("\n");
      // skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // CSV: fips_code,name,lng,lat
        const parts = line.split(",");
        if (parts.length < 4) continue;
        const fips = parts[0].trim();
        const rawName = parts[1].trim();
        const lng = parseFloat(parts[2]);
        const lat = parseFloat(parts[3]);
        if (isNaN(lat) || isNaN(lng)) continue;
        const stCode = FIPS_TO_STATE[fips.substring(0, 2)];
        if (!stCode) continue;
        // Normalise: strip " County" suffix, uppercase
        const cleanName = rawName.replace(/\s+county$/i, "").trim().toUpperCase();
        const key = `${cleanName}, ${stCode}`;
        map[key] = { lat, lng };
      }
      _centroidsCache = map;
      return map;
    } catch (e) {
      console.warn("[agentScoring] Failed to load county centroids:", e);
      _centroidsCache = {};
      return {};
    }
  })();
  return _centroidsPromise.ref;
}

/**
 * Get the centroid for a county.
 * @param {string} countyName - e.g. "Cook County" or "Cook"
 * @param {string} stateCode  - e.g. "IL"
 * @returns {Promise<{lat:number, lng:number}|null>}
 */
export async function getCountyCentroid(countyName, stateCode) {
  if (!countyName || !stateCode) return null;
  const centroids = await loadCentroids();
  const clean = countyName.replace(/\s+county$/i, "").trim().toUpperCase();
  const st = stateCode.trim().toUpperCase();
  return centroids[`${clean}, ${st}`] || null;
}

// ─── ZIP Geocoding ───

/**
 * Get lat/lng from a US ZIP code via zippopotam.us
 * @param {string} zipCode
 * @returns {Promise<{lat:number, lng:number}|null>}
 */
export async function getZipCoords(zipCode) {
  if (!zipCode || zipCode.length < 5) return null;
  try {
    const resp = await fetch(`https://api.zippopotam.us/us/${zipCode.trim()}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const place = data?.places?.[0];
    if (!place) return null;
    return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
  } catch (_) {
    return null;
  }
}

// ─── Haversine Distance ───

/**
 * Returns straight-line distance in miles between two lat/lng points.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Scoring Functions ───

export function distanceScore(miles) {
  if (miles == null || isNaN(miles)) return 40; // neutral fallback
  if (miles <= 25) return 100;
  if (miles <= 50) return 80;
  if (miles <= 100) return 60;
  if (miles <= 200) return 35;
  return 10;
}

export function ratingScore(rating, reviewCount) {
  if (!rating || !reviewCount) return 25;
  return Math.round((rating / 5) * 80);
}

export function activityScore(ikDealCount, externalDeals) {
  return Math.min((ikDealCount || 0) * 3, 15) + Math.min((externalDeals || 0) * 1, 5);
}

// ─── Hard Filter Helper ───

function normalizeState(s) {
  return (s || "").trim().toUpperCase().substring(0, 2);
}

function agentHasState(agent, dealState) {
  const target = normalizeState(dealState);
  if (!target) return false;

  // Check agent.agent.state_licenses (object keys)
  const sl = agent.agent?.state_licenses;
  if (sl && typeof sl === "object") {
    if (Object.keys(sl).some((k) => normalizeState(k) === target)) return true;
  }
  // Check agent.agent.licensed_states (array)
  const ls = agent.agent?.licensed_states;
  if (Array.isArray(ls) && ls.some((s) => normalizeState(s) === target)) return true;
  // Check agent.agent.markets (array)
  const am = agent.agent?.markets;
  if (Array.isArray(am) && am.some((s) => normalizeState(s) === target)) return true;
  // Check agent.markets (array)
  const tm = agent.markets;
  if (Array.isArray(tm) && tm.some((s) => normalizeState(s) === target)) return true;

  return false;
}

// ─── Main Ranking Function ───

/**
 * Rank agents for a deal.
 * @param {Array} agents - All agent profiles
 * @param {{ state: string, county?: string, lat?: number, lng?: number }} dealLocation
 * @param {Map} ratingsMap - agentId -> { rating, reviewCount }
 * @param {Map} ikDealsMap - agentId -> number of IK deals
 * @returns {Array} Sorted agents with matchData attached
 */
export function rankAgentsForDeal(agents, dealLocation, ratingsMap, ikDealsMap) {
  const dealState = dealLocation?.state || "";
  const dealLat = dealLocation?.lat;
  const dealLng = dealLocation?.lng;
  const hasDealCoords = dealLat != null && dealLng != null && !isNaN(dealLat) && !isNaN(dealLng);

  // Hard filter: agent must be licensed in the deal's state
  const eligible = agents.filter((a) => agentHasState(a, dealState));

  // Score each agent
  const scored = eligible.map((agent) => {
    const agentLat = agent.agent?.lat;
    const agentLng = agent.agent?.lng;
    const hasAgentCoords = agentLat != null && agentLng != null && !isNaN(agentLat) && !isNaN(agentLng);

    let miles = null;
    let dScore = 40; // neutral fallback
    if (hasDealCoords && hasAgentCoords) {
      miles = haversineDistance(agentLat, agentLng, dealLat, dealLng);
      dScore = distanceScore(miles);
    }

    const r = ratingsMap?.get(agent.id) || { rating: null, reviewCount: 0 };
    const rScore = ratingScore(r.rating, r.reviewCount);
    const externalDeals = agent.agent?.investment_deals_last_12m || 0;
    const ikCount = ikDealsMap?.get(agent.id) || 0;
    const aScore = activityScore(ikCount, externalDeals);
    const totalScore = dScore + rScore + aScore;

    const badges = [];
    if (miles != null && miles <= 25) badges.push("local");
    if (r.rating >= 4.5 && r.reviewCount >= 3) badges.push("topRated");

    return {
      ...agent,
      matchData: {
        totalScore,
        distanceScore: dScore,
        distanceMiles: miles != null ? Math.round(miles) : null,
        ratingScore: rScore,
        activityScore: aScore,
        badges,
      },
    };
  });

  // Sort: totalScore DESC, rating DESC, name ASC
  scored.sort((a, b) => {
    if (b.matchData.totalScore !== a.matchData.totalScore)
      return b.matchData.totalScore - a.matchData.totalScore;
    const rA = ratingsMap?.get(a.id)?.rating || 0;
    const rB = ratingsMap?.get(b.id)?.rating || 0;
    if (rB !== rA) return rB - rA;
    return (a.full_name || "").localeCompare(b.full_name || "");
  });

  // Assign bestMatch badge to #1
  if (scored.length > 0) {
    scored[0].matchData.badges = [...scored[0].matchData.badges, "bestMatch"];
  }

  return scored;
}