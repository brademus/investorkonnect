{
  "version": "1.0.1",
  "clauses": {
    "A_AGENCY_STD": {
      "id": "A_AGENCY_STD",
      "category": "A",
      "title": "Standard Disclosure",
      "text": "Agent acknowledges that execution of this Agreement constitutes substantive contact. Agent represents they have delivered the mandatory state-specific Agency Law Disclosure pamphlet to Investor prior to execution.",
      "dependencies": []
    },
    "A_TRANS_BROKER": {
      "id": "A_TRANS_BROKER",
      "category": "A",
      "title": "Transaction Broker",
      "text": "The Parties agree that Agent is acting as a Transaction Broker (neutral facilitator) and NOT as a fiduciary advocate, unless a specific Single Agency agreement is signed.",
      "dependencies": []
    },
    "A_TX_IABS": {
      "id": "A_TX_IABS",
      "category": "A",
      "title": "Texas IABS",
      "text": "Agent represents they have delivered the Texas Information About Brokerage Services (IABS) form to Investor via the Platform.",
      "dependencies": [{"type": "state", "value": "TX"}]
    },
    "A_NY_DISCL": {
      "id": "A_NY_DISCL",
      "category": "A",
      "title": "NY Agency",
      "text": "Agent represents they have provided the New York State Disclosure Form for Buyer and Seller pursuant to RPL § 443.",
      "dependencies": [{"type": "state", "value": "NY"}]
    },
    "B_NET_BANNED": {
      "id": "B_NET_BANNED",
      "category": "B",
      "title": "Net Prohibited",
      "text": "**WARNING: NET LISTINGS PROHIBITED.** The laws of this State prohibit Net Listings. Any 'Net' or 'Spread' calculation in Exhibit A is for estimation only. The Parties agree to execute a Brokerage Listing with a fixed Flat Fee or Commission %.",
      "dependencies": []
    },
    "B_NET_RESTR": {
      "id": "B_NET_RESTR",
      "category": "B",
      "title": "Net Restricted",
      "text": "**NET LISTING RESTRICTIONS.** Agent agrees to execute the specific State-Approved Net Listing Addendum to ensure the maximum commission amount is clearly disclosed to the Principal as required by License Law.",
      "dependencies": []
    },
    "B_NET_STD": {
      "id": "B_NET_STD",
      "category": "B",
      "title": "Net Standard",
      "text": "Compensation shall be calculated based on the 'Net' or 'Spread' model as defined in Exhibit A, subject to the Agent's Brokerage Policy.",
      "dependencies": []
    },
    "C_EQ_INT_STD": {
      "id": "C_EQ_INT_STD",
      "category": "C",
      "title": "Standard Notice",
      "text": "Agent acknowledges Investor is marketing an Equitable Interest (contract rights) and not legal title. All marketing must explicitly state: 'Sale of Equitable Interest' or 'Assignment of Contract'.",
      "dependencies": []
    },
    "C_IL_STRICT": {
      "id": "C_IL_STRICT",
      "category": "C",
      "title": "IL Warning",
      "text": "**ILLINOIS LICENSE ACT NOTICE:** Agent shall ensure all advertising explicitly identifies the property interest as an 'Equitable Interest'. Investor represents they are a principal in the transaction.",
      "dependencies": [{"type": "state", "value": "IL"}]
    },
    "C_OK_PRED": {
      "id": "C_OK_PRED",
      "category": "C",
      "title": "OK Predatory Act",
      "text": "**OKLAHOMA NOTICE:** Pursuant to the Predatory Real Estate Wholesaler Prohibition Act, Agent shall not market the Property without a valid written brokerage agreement and clear disclosure of the Investor's interest type.",
      "dependencies": [{"type": "state", "value": "OK"}]
    },
    "E_LIST_REQ": {
      "id": "E_LIST_REQ",
      "category": "E",
      "title": "Listing Required",
      "text": "**NO MARKETING UNTIL LISTED.** This Agreement is a preliminary operating agreement. Agent agrees NOT to activate any MLS listing or public marketing until the Parties execute the official State-Mandated Exclusive Listing Agreement.",
      "dependencies": []
    },
    "E_BROKER_ACK": {
      "id": "E_BROKER_ACK",
      "category": "E",
      "title": "Broker Auth",
      "text": "Agent represents that their Broker of Record has authorized this transaction type. Agent shall upload a 'Broker Acknowledgement' to the Platform within 48 hours.",
      "dependencies": []
    },
    "G_NO_SELLER": {
      "id": "G_NO_SELLER",
      "category": "G",
      "title": "Privacy Guard",
      "text": "Agent shall NOT publicly identify the Record Owner (Seller) in any MLS public remarks or internet advertising.",
      "dependencies": []
    },
    "H_PAY_BROKER": {
      "id": "H_PAY_BROKER",
      "category": "H",
      "title": "Payment Routing",
      "text": "All compensation must be paid directly to Agent's Brokerage of Record via the Closing Statement. Direct payments to Agent are prohibited.",
      "dependencies": []
    },
    "J_PHL_LIC": {
      "id": "J_PHL_LIC",
      "category": "J",
      "title": "Philadelphia Lic",
      "text": "**PHILADELPHIA WHOLESALER LICENSE.** Investor warrants they hold a valid Philadelphia Residential Property Wholesaler License (Code 9-5200) and have provided their License Number to the Platform.",
      "dependencies": [{"type": "city", "value": "PHILA"}]
    }
  }
}