// Canonical createPageUrl implementation
export function createPageUrl(pageName) {
  // Canonical behavior:
  // "DashboardInvestor" → "/DashboardInvestor"
  // "Pricing" → "/Pricing"
  return '/' + pageName;
}

export default {
  createPageUrl,
};