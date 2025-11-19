import { createPageUrl as createPageUrlTs } from '@/utils';

export function createPageUrl(pageName) {
  return createPageUrlTs(pageName);
}

export default {
  createPageUrl,
}