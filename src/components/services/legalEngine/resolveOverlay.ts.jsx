import { loadLegalPack } from './loadPack';

/**
 * Resolves city overlay enum from property ZIP code
 * Returns null if no overlay detected
 * 
 * Example: ZIP 19103 -> "PHILA"
 */
export function resolveOverlay(propertyZip: string): string | null {
  if (!propertyZip) return null;
  
  const pack = loadLegalPack();
  const mapping = pack.config.city_overlay_mapping;
  
  // Direct lookup
  if (mapping[propertyZip]) {
    return mapping[propertyZip];
  }
  
  // ZIP prefix matching (e.g., 191xx -> PHILA)
  const zipPrefix = propertyZip.substring(0, 3);
  for (const [zip, overlay] of Object.entries(mapping)) {
    if (zip.startsWith(zipPrefix)) {
      return overlay as string;
    }
  }
  
  return null;
}