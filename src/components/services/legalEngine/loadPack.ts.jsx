// Legal pack loader with runtime JSON loading
// Avoids static import issues with JSON files

let cachedPack: any = null;

export async function loadLegalPack() {
  if (cachedPack) {
    return cachedPack;
  }

  try {
    // Load pack files at runtime
    const [config, clauses, modules, templates, termsSchema] = await Promise.all([
      fetch('/components/legal_pack/legal_engine_config.json').then(r => r.json()),
      fetch('/components/legal_pack/legal_clauses.json').then(r => r.json()),
      fetch('/components/legal_pack/deep_dive_modules.json').then(r => r.json()),
      fetch('/components/legal_pack/templates.json').then(r => r.json()),
      fetch('/components/legal_pack/terms_schema.json').then(r => r.json())
    ]);

    cachedPack = {
      config,
      clauses,
      modules,
      templates,
      termsSchema
    };

    return cachedPack;
  } catch (error) {
    throw new Error('Legal pack v1.0.1 missing: failed to load from /components/legal_pack/');
  }
}

// Synchronous version with inline minimal pack (fallback)
export function loadLegalPackSync() {
  if (cachedPack) return cachedPack;
  
  // Inline minimal pack for immediate availability
  return {
    config: {
      version: "1.0.1",
      net_policy_by_state: {
        IL: "BANNED", NY: "BANNED", TX: "RESTRICTED", CA: "RESTRICTED"
      },
      city_overlay_mapping: {
        "19103": "PHILA", "19102": "PHILA", "19104": "PHILA"
      },
      hard_blocks: {
        IL_UNLICENSED_PATTERN: {
          message: "Illinois law prohibits unlicensed individuals from engaging in a pattern of real estate business."
        }
      }
    },
    clauses: { clauses: {} },
    modules: { modules: {} },
    templates: {
      master_agreement: "# MASTER AGREEMENT\n\nPlaceholder",
      addendum_chassis: "# STATE ADDENDUM\n\nPlaceholder"
    },
    termsSchema: {}
  };
}