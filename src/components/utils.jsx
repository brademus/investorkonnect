// Wrapper for createPageUrl utility
export function createPageUrl(pageName) {
  // Our routes in src/pages/index.jsx are defined as "/Home", "/Pricing",
  // "/DashboardInvestor", etc. We want createPageUrl("DashboardInvestor")
  // to return "/DashboardInvestor" exactly.
  return '/' + pageName;
}