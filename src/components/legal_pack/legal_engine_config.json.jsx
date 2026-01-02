{
  "version": "1.0.1",
  "governing_law": "PROPERTY_STATE",
  "net_policy_by_state": {
    "IL": "BANNED",
    "NY": "BANNED",
    "TX": "RESTRICTED",
    "CA": "RESTRICTED",
    "FL": "ALLOWED"
  },
  "nj_attorney_review": {
    "enabled": true,
    "business_days": 3,
    "day_zero_is_delivery": true,
    "auto_approve_on_expiry": true
  },
  "transaction_types": ["ASSIGNMENT", "DOUBLE_CLOSE"],
  "evaluation_order": [
    "deep_dive_checks",
    "local_overlays",
    "state_defaults"
  ],
  "city_overlay_mapping": {
    "19103": "PHILA",
    "19102": "PHILA",
    "19104": "PHILA",
    "19106": "PHILA",
    "19107": "PHILA"
  },
  "hard_blocks": {
    "IL_UNLICENSED_PATTERN": {
      "state": "IL",
      "investor_status": "UNLICENSED",
      "deal_count_threshold": 1,
      "message": "Illinois law prohibits unlicensed individuals from engaging in a pattern of business (more than 1 transaction in 12 months). Cannot proceed."
    }
  }
}