/**
 * Default next-steps message template and placeholder replacement logic.
 */

export const DEFAULT_NEXT_STEPS_TEMPLATE = `Next Steps for {{PROPERTY_ADDRESS}}

Hi {{AGENT_FIRST_NAME}},

Thank you for partnering with {{PARTNER_NAME}} on the property at {{PROPERTY_ADDRESS}}. I'm looking forward to working together.

Below is a clear outline of the next steps so we're aligned from the start.

Step 1: Initial Walkthrough

We are planning to schedule the walkthrough for:

{{WALKTHROUGH_DATE}} at {{WALKTHROUGH_TIME}}

Please let me know if that works for you, or feel free to suggest another time.

During the walkthrough, please:

- Take clear, detailed photos of the entire property (interior and exterior)
- Make note of any visible defects, damages, or repair items that could impact financing
- Provide your professional feedback on condition and marketability
- Prepare and send your CMA (Comparative Market Analysis)
- Include:
  - Estimated As-Is Listing Price
  - Estimated ARV (After Repair Value)

Step 2: Submission & Review

After the walkthrough, please upload the following directly to the Deal Room under the Documents tab (or send to {{INVESTOR_EMAIL}}):

- All photos
- Your written notes
- CMA report
- As-Is Listing Price
- ARV

Once reviewed, we'll confirm alignment and move forward with next steps.

Looking forward to working together.

Best,
{{INVESTOR_FULL_NAME}}
{{INVESTOR_PHONE_NUMBER}}
{{INVESTOR_EMAIL}}`;

/**
 * List of available placeholders for the template editor help text
 */
export const TEMPLATE_PLACEHOLDERS = [
  { key: '{{PROPERTY_ADDRESS}}', label: 'Property address' },
  { key: '{{AGENT_FIRST_NAME}}', label: "Agent's first name" },
  { key: '{{PARTNER_NAME}}', label: 'Your company name or "me"' },
  { key: '{{WALKTHROUGH_DATE}}', label: 'Walkthrough date or "To Be Scheduled"' },
  { key: '{{WALKTHROUGH_TIME}}', label: 'Walkthrough time or "To Be Scheduled"' },
  { key: '{{INVESTOR_FULL_NAME}}', label: 'Your full name' },
  { key: '{{INVESTOR_PHONE_NUMBER}}', label: 'Your phone number' },
  { key: '{{INVESTOR_EMAIL}}', label: 'Your email address' },
];

export default DEFAULT_NEXT_STEPS_TEMPLATE;