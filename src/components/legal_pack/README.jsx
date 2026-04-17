// InvestorKonnect Legal Pack v1.0.1 — Documentation
export default {
  version: "1.0.1",
  description: "Immutable legal specification pack for contract generation",
  files: [
    "legal_engine_config — Net policy, NJ timing, overlays, hard blocks",
    "legal_clauses — Clause bank with dependencies",
    "deep_dive_modules — State-specific deep-dive modules (IL, PA, NJ)",
    "templates — Master agreement and addendum chassis templates",
    "terms_schema — Exhibit A JSON schema"
  ],
  notes: [
    "ZIP code mapping drives city overlay detection (not free-text city)",
    "NJ attorney review: 3 business days, Day 0 = delivery, weekends excluded",
    "IL hard block: unlicensed + >1 deal in 365 days = blocked",
    "Net policy: BANNED (IL, NY), RESTRICTED (TX, CA), ALLOWED (others)"
  ]
};