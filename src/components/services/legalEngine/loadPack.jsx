// Legal pack loader — uses static imports from .js modules
import config from '../../legal_pack/legal_engine_config';
import clauses from '../../legal_pack/legal_clauses';
import modules from '../../legal_pack/deep_dive_modules';
import templates from '../../legal_pack/templates';
import termsSchema from '../../legal_pack/terms_schema';

const pack = { config, clauses, modules, templates, termsSchema };

export async function loadLegalPack() {
  return pack;
}

export function loadLegalPackSync() {
  return pack;
}