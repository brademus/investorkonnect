import { createPageUrl as createPageUrlTs } from "@/utils";

// Small JS shim so components can import from "@/components/utils"
export function createPageUrl(pageName) {
  return createPageUrlTs(pageName);
}

export default {
  createPageUrl,
};