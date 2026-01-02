import { loadLegalPack } from './loadPack';

export function resolveOverlay(propertyZip: string): string | null {
  const pack = loadLegalPack();
  const mapping = pack.config.city_overlay_mapping;
  
  return mapping[propertyZip] || null;
}