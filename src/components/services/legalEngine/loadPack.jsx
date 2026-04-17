// Legal pack loader — imports JS modules directly
import configData from '../../legal_pack/legal_engine_config';
import clausesData from '../../legal_pack/legal_clauses';
import modulesData from '../../legal_pack/deep_dive_modules';
import templatesData from '../../legal_pack/templates';
import termsSchemaData from '../../legal_pack/terms_schema';

let cachedPack = null;

export async function loadLegalPack() {
  if (cachedPack) return cachedPack;
  cachedPack = {
    config: configData,
    clauses: clausesData,
    modules: modulesData,
    templates: templatesData,
    termsSchema: termsSchemaData
  };
  return cachedPack;
}

export function loadLegalPackSync() {
  if (cachedPack) return cachedPack;
  cachedPack = {
    config: configData,
    clauses: clausesData,
    modules: modulesData,
    templates: templatesData,
    termsSchema: termsSchemaData
  };
  return cachedPack;
}