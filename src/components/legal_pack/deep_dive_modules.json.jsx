{
  "version": "1.0.1",
  "modules": {
    "IL_DEEP_DIVE": {
      "id": "IL_DEEP_DIVE",
      "name": "Illinois Deep Dive",
      "trigger": {"type": "state", "value": "IL"},
      "injections": [
        {
          "target": "section_5",
          "title": "Illinois License Act Compliance",
          "content": "**5.1 ILLINOIS LICENSE ACT COMPLIANCE.** The Parties acknowledge that under the Illinois Real Estate License Act (225 ILCS 454), the marketing of an equitable interest is a licensed activity unless the Investor is a \"principal\" to the transaction.\n\n**5.2 ONE-TRANSACTION LIMIT.** If Investor is unlicensed, Investor represents they have not engaged in a pattern of business (defined as more than 1 transaction in a 12-month period) that would require licensure."
        },
        {
          "target": "section_6",
          "title": "Net Listings Void",
          "content": "**6.1 NET LISTINGS VOID.** Net listings are illegal in Illinois. Compensation defaults to the Flat Fee equivalent defined in Exhibit A."
        }
      ]
    },
    "PA_DEEP_DIVE": {
      "id": "PA_DEEP_DIVE",
      "name": "Pennsylvania Deep Dive",
      "trigger": {"type": "state", "value": "PA"},
      "injections": [
        {
          "target": "section_5",
          "title": "Equitable Interest Disclosure",
          "content": "**5.1 EQUITABLE INTEREST DISCLOSURE.** Pursuant to the Real Estate Licensing and Registration Act (RELRA), Agent must disclose in all advertisements that the Property is not owned by Investor but is subject to a contract of sale.\n\n**5.2 CONSUMER NOTICE.** Agent acknowledges delivery of the PA Consumer Notice to Investor."
        }
      ]
    },
    "NJ_ATTORNEY_REVIEW": {
      "id": "NJ_ATTORNEY_REVIEW",
      "name": "New Jersey Attorney Review",
      "trigger": {"type": "state", "value": "NJ"},
      "injections": [
        {
          "target": "section_7",
          "title": "Attorney Review Period",
          "content": "**7.1 THREE-DAY ATTORNEY REVIEW.** This Agreement is subject to New Jersey's Three Business Day Attorney Review Period. Either party may cancel within three (3) business days of delivery (Day 0 = delivery day; weekends and holidays excluded). If no cancellation notice is received by 11:59 PM on Day 3, this Agreement becomes binding and non-cancellable."
        }
      ]
    }
  }
}