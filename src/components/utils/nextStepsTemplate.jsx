
/**
 * Default next-steps message template — smart conditional version.
 * The walkthrough section is handled automatically at render time:
 *   - If a walkthrough date+time are set → shows scheduled block
 *   - Otherwise → asks agent for availability
 * The template editor only controls the static portions.
 */

export const DEFAULT_NEXT_STEPS_TEMPLATE = `Hi {{AGENT_FIRST_NAME}},

Thank you for signing the agreement on the {{PROPERTY_ADDRESS}} deal. We're excited to move forward together.

Here's what happens next:

{{WALKTHROUGH_SECTION}}

Once the walkthrough is complete, we'll send you the inspection report and any additional details needed for closing.

Please feel free to reach out if you have any questions:
• Email: {{INVESTOR_EMAIL}}
• Phone: {{INVESTOR_PHONE_NUMBER}}

Best regards,
{{INVESTOR_FULL_NAME}}`;

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
