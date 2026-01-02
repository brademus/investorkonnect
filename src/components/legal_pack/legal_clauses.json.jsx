{
  "clauses": {
    "A_AGENCY_STD": {
      "id": "A_AGENCY_STD",
      "category": "A",
      "title": "Agency Relationship",
      "text": "Agent represents Investor as a transaction broker under applicable state law. Agent's duty is to facilitate the transaction and does not extend to fiduciary obligations unless otherwise specified by law.",
      "dependencies": []
    },
    "A_TRANS_BROKER": {
      "id": "A_TRANS_BROKER",
      "category": "A",
      "title": "Transaction Broker Status",
      "text": "Agent acts as a transaction broker and will provide limited representation as defined by state regulations. Agent will assist in locating properties, coordinating due diligence, and facilitating closing.",
      "dependencies": []
    },
    "B_NET_BANNED": {
      "id": "B_NET_BANNED",
      "category": "B",
      "title": "Net Listing Prohibition",
      "text": "Net listings are prohibited in this jurisdiction. All compensation shall be structured as either a flat fee or percentage of purchase price.",
      "dependencies": [
        { "type": "net_policy", "value": "BANNED" }
      ]
    },
    "B_NET_RESTR": {
      "id": "B_NET_RESTR",
      "category": "B",
      "title": "Net Listing Addendum Required",
      "text": "If compensation is structured as a net listing, the parties acknowledge that a separate Net Listing Addendum complying with state requirements must be executed.",
      "dependencies": [
        { "type": "net_policy", "value": "RESTRICTED" }
      ]
    },
    "B_NET_STD": {
      "id": "B_NET_STD",
      "category": "B",
      "title": "Standard Compensation Terms",
      "text": "Compensation shall be as specified in Exhibit A and is due upon successful closing of the transaction or as otherwise agreed in writing.",
      "dependencies": []
    },
    "C_EQ_INT_STD": {
      "id": "C_EQ_INT_STD",
      "category": "C",
      "title": "Equitable Interest",
      "text": "Investor acknowledges that entering into this agreement creates an equitable interest in any property identified under its terms. Investor agrees not to circumvent Agent or attempt direct contact with sellers.",
      "dependencies": []
    },
    "E_LIST_REQ": {
      "id": "E_LIST_REQ",
      "category": "E",
      "title": "Listing Agreement Required",
      "text": "Agent warrants that they will obtain a valid listing agreement or procuring cause documentation for any property presented to Investor under this agreement.",
      "dependencies": []
    },
    "E_BROKER_ACK": {
      "id": "E_BROKER_ACK",
      "category": "E",
      "title": "Brokerage Acknowledgment",
      "text": "Agent acknowledges they are acting under the supervision of their sponsoring broker and will comply with all brokerage policies and state licensing requirements.",
      "dependencies": []
    },
    "G_NO_SELLER": {
      "id": "G_NO_SELLER",
      "category": "G",
      "title": "No Direct Seller Contact",
      "text": "Investor agrees not to contact sellers directly or attempt to circumvent Agent's involvement in any transaction introduced under this agreement.",
      "dependencies": []
    },
    "H_PAY_BROKER": {
      "id": "H_PAY_BROKER",
      "category": "H",
      "title": "Payment Through Broker",
      "text": "All compensation due to Agent shall be paid through Agent's sponsoring broker in accordance with standard real estate closing procedures.",
      "dependencies": []
    },
    "J_PHL_LIC": {
      "id": "J_PHL_LIC",
      "category": "J",
      "title": "Philadelphia License Requirement",
      "text": "Agent warrants that they hold an active real estate license in Pennsylvania and are authorized to conduct transactions in Philadelphia County. Agent will comply with all Philadelphia-specific real estate regulations and disclosure requirements.",
      "dependencies": [
        { "type": "city", "value": "PHILA" }
      ]
    }
  }
}