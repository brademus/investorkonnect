/**
 * Default next-steps message template — smart conditional version.
 * The walkthrough section is handled automatically at render time:
 *   - If a walkthrough date+time are set → shows scheduled block
 *   - Otherwise → asks agent for availability
 * The template editor only controls the static portions.
 */

export const DEFAULT_NEXT_STEPS_TEMPLATE = `Next Steps for {{PROPERTY_ADDRESS}}

Hi {{AGENT_FIRST_NAME}},

Thank you for partnering with {{PARTNER_NAME}} on the property at {{PROPERTY_ADDRESS}}. I'm looking forward to working together.

Below is a clear outline of the next steps so we're aligned from the start.

Step 1: Initial Walkthrough

{{WALKTHROUGH_SECTION}}

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
  { key: '{{WALKTHROUGH_SECTION}}', label: 'Auto: shows scheduled date/time or asks for availability' },
  { key: '{{INVESTOR_FULL_NAME}}', label: 'Your full name' },
  { key: '{{INVESTOR_PHONE_NUMBER}}', label: 'Your phone number' },
  { key: '{{INVESTOR_EMAIL}}', label: 'Your email address' },
];

export default DEFAULT_NEXT_STEPS_TEMPLATE;