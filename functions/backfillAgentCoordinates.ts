import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
  const resp = await fetch("https://gist.githubusercontent.com/russellsamora/12be4f9f574e92413ea3f92ce1bc58e6/raw/");
  const text = await resp.text();
  const map = {};
  const lines = text.trim().split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    if (parts.length < 5) continue;
    const fips = parts[0].trim();
    const rawName = parts[1].trim();
    const lat = parseFloat(parts[3]);
    const lng = parseFloat(parts[4]);
    if (isNaN(lat) || isNaN(lng)) continue;
    const stCode = FIPS_TO_STATE[fips.substring(0, 2)];
    if (!stCode) continue;
    const cleanName = rawName.replace(/\s+county$/i, "").trim().toUpperCase();
    const key = `${cleanName}, ${stCode}`;
    map[key] = { lat, lng };
  }
  return map;
}

function getCountyCentroid(centroids, countyName, stateCode) {
  if (!countyName || !stateCode) return null;
  const clean = countyName.replace(/\s+county$/i, "").trim().toUpperCase();
  const st = stateCode.trim().toUpperCase();
  return centroids[`${clean}, ${st}`] || null;
}

function resolveState(agent) {
  const agentData = agent.agent || {};
  // 1. First key of state_licenses
  if (agentData.state_licenses && typeof agentData.state_licenses === 'object') {
    const keys = Object.keys(agentData.state_licenses);
    if (keys.length > 0) return keys[0].trim().toUpperCase().substring(0, 2);
  }
  // 2. First entry of licensed_states
  if (Array.isArray(agentData.licensed_states) && agentData.licensed_states.length > 0) {
    return agentData.licensed_states[0].trim().toUpperCase().substring(0, 2);
  }
  // 3. First entry of markets
  if (Array.isArray(agentData.markets) && agentData.markets.length > 0) {
    return agentData.markets[0].trim().toUpperCase().substring(0, 2);
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Load county centroids once
    const centroids = await loadCentroids();
    console.log(`Loaded ${Object.keys(centroids).length} county centroids`);

    // Fetch all agent profiles
    const agents = await base44.asServiceRole.entities.Profile.filter({ user_role: 'agent' });
    console.log(`Found ${agents.length} agent profiles`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const agent of agents) {
      const agentData = agent.agent || {};

      // Skip if already has coordinates
      if (agentData.lat != null && agentData.lng != null) {
        skipped++;
        continue;
      }

      const county = agentData.main_county;
      const state = resolveState(agent);

      if (!county || !state) {
        notFound++;
        continue;
      }

      const coords = getCountyCentroid(centroids, county, state);
      if (!coords) {
        notFound++;
        continue;
      }

      // Update agent profile with coordinates
      await base44.asServiceRole.entities.Profile.update(agent.id, {
        agent: { ...agentData, lat: coords.lat, lng: coords.lng }
      });
      updated++;
    }

    const summary = { total: agents.length, updated, skipped, notFound };
    console.log('Backfill complete:', summary);
    return Response.json(summary);
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});