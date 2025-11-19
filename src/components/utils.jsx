// Canonical createPageUrl implementation
export function createPageUrl(pageName) {
  // Given "DashboardInvestor" → "/DashboardInvestor"
  // Given "Pricing" → "/Pricing"
  // We rely on React Router's case-insensitive matching.
  return '/' + pageName;
}

export default {
  createPageUrl,
};