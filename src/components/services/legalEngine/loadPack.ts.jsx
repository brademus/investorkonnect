import config from '../../legal_pack/legal_engine_config.json';
import clauses from '../../legal_pack/legal_clauses.json';
import modules from '../../legal_pack/deep_dive_modules.json';
import templates from '../../legal_pack/templates.json';
import termsSchema from '../../legal_pack/terms_schema.json';

export interface LegalPack {
  config: typeof config;
  clauses: typeof clauses;
  modules: typeof modules;
  templates: typeof templates;
  termsSchema: typeof termsSchema;
}

// Module-level singleton cache
let cachedPack: LegalPack | null = null;

export function loadLegalPack(): LegalPack {
  if (cachedPack) {
    return cachedPack;
  }

  // Validate pack is present
  if (!config || !clauses || !modules || !templates || !termsSchema) {
    throw new Error('Legal pack v1.0.1 missing: one or more required files not found');
  }

  cachedPack = {
    config,
    clauses,
    modules,
    templates,
    termsSchema
  };

  return cachedPack;
}