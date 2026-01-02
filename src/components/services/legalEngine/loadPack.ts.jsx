import config from '../legal_pack/legal_engine_config.json';
import clauses from '../legal_pack/legal_clauses.json';
import modules from '../legal_pack/deep_dive_modules.json';
import templates from '../legal_pack/templates.json';
import termsSchema from '../legal_pack/terms_schema.json';

export interface LegalPack {
  config: typeof config;
  clauses: typeof clauses;
  modules: typeof modules;
  templates: typeof templates;
  termsSchema: typeof termsSchema;
}

export function loadLegalPack(): LegalPack {
  return {
    config,
    clauses,
    modules,
    templates,
    termsSchema
  };
}