import { loadLegalPackSync } from './loadPack';

export function resolveOverlay(propertyZip) {
  if (!propertyZip) return null;
  
  const pack = loadLegalPackSync();
  const mapping = pack.config.city_overlay_mapping || {};
  
  if (mapping[propertyZip]) {
    return mapping[propertyZip];
  }
  
  const zipPrefix = propertyZip.substring(0, 3);
  for (const [zip, overlay] of Object.entries(mapping)) {
    if (zip.startsWith(zipPrefix)) {
      return overlay;
    }
  }
  
  return null;
}