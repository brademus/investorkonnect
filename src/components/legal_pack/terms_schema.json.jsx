{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Exhibit A Terms Snapshot",
  "type": "object",
  "required": ["compensation_model", "transaction_type"],
  "properties": {
    "compensation_model": {
      "type": "string",
      "enum": ["FLAT_FEE", "COMMISSION_PCT", "NET_SPREAD"]
    },
    "flat_fee_amount": {
      "type": "number",
      "minimum": 0
    },
    "commission_percentage": {
      "type": "number",
      "minimum": 0,
      "maximum": 100
    },
    "net_target": {
      "type": "number",
      "minimum": 0
    },
    "converted_from_net": {
      "type": "boolean",
      "description": "True if this was converted from net due to state ban"
    },
    "transaction_type": {
      "type": "string",
      "enum": ["ASSIGNMENT", "DOUBLE_CLOSE"]
    },
    "buyer_commission_type": {
      "type": "string",
      "enum": ["FLAT_FEE", "COMMISSION_PCT"]
    },
    "buyer_commission_amount": {
      "type": "number"
    },
    "seller_commission_type": {
      "type": "string",
      "enum": ["FLAT_FEE", "COMMISSION_PCT"]
    },
    "seller_commission_amount": {
      "type": "number"
    },
    "agreement_length_days": {
      "type": "integer",
      "minimum": 1
    },
    "termination_notice_days": {
      "type": "integer",
      "minimum": 1
    }
  }
}