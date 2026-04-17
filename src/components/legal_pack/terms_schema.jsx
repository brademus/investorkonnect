{
  "type": "object",
  "title": "Exhibit A - Agreement Terms",
  "properties": {
    "compensation_model": {
      "type": "string",
      "enum": ["FLAT_FEE", "COMMISSION_PCT", "NET_SPREAD"],
      "description": "Compensation structure"
    },
    "flat_fee_amount": {
      "type": "number",
      "description": "Flat fee in dollars (if FLAT_FEE)"
    },
    "commission_percentage": {
      "type": "number",
      "description": "Commission percentage (if COMMISSION_PCT)"
    },
    "net_target": {
      "type": "number",
      "description": "Net target amount (if NET_SPREAD and allowed)"
    },
    "transaction_type": {
      "type": "string",
      "enum": ["ASSIGNMENT", "DOUBLE_CLOSE"],
      "description": "Type of transaction"
    },
    "buyer_commission_type": {
      "type": "string",
      "enum": ["percentage", "flat"],
      "description": "Buyer side commission type"
    },
    "buyer_commission_amount": {
      "type": "number",
      "description": "Buyer commission amount or percentage"
    },
    "seller_commission_type": {
      "type": "string",
      "enum": ["percentage", "flat"],
      "description": "Seller side commission type"
    },
    "seller_commission_amount": {
      "type": "number",
      "description": "Seller commission amount or percentage"
    },
    "agreement_length_days": {
      "type": "integer",
      "default": 180,
      "description": "Agreement duration in days"
    },
    "termination_notice_days": {
      "type": "integer",
      "default": 30,
      "description": "Notice period for termination"
    },
    "converted_from_net": {
      "type": "boolean",
      "description": "Whether this was converted from net listing (legacy)"
    }
  },
  "required": ["compensation_model", "transaction_type", "agreement_length_days"]
}