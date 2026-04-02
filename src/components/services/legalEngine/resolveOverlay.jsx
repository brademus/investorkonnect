import { loadLegalPackSync } from './loadPack';

export function resolveOverlay(propertyZip: string): string | null {
  if (!propertyZip) return null;
  
  const pack = loadLegalPackSync();
  const mapping = pack.config.city_overlay_mapping || {};
  
  // Direct lookup
  if (mapping[propertyZip]) {
    return mapping[propertyZip];
  }
  
  // ZIP prefix matching (191xx -> PHILA)
  const zipPrefix = propertyZip.substring(0, 3);
  for (const [zip, overlay] of Object.entries(mapping)) {
    if (zip.startsWith(zipPrefix)) {
      return overlay as string;
    }
  }
  
  return null;
}