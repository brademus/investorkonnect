import React from "react";
import { FileText } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Terms of Service</h1>
          </div>

          <p className="text-sm text-slate-600 mb-8">Last Updated: January 1, 2025</p>

          <div className="prose prose-slate max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>By accessing AgentVault, you agree to these Terms of Service. If you disagree, discontinue use immediately.</p>

            <h2>2. Platform Purpose</h2>
            <p>AgentVault connects investors with verified real estate agents. We facilitate connections but are not party to transactions between users.</p>

            <h2>3. User Accounts</h2>
            <h3>Investors</h3>
            <ul>
              <li>Must be 18+ years old</li>
              <li>Provide accurate information</li>
              <li>Maintain account security</li>
              <li>Sign platform NDA before accessing protected content</li>
            </ul>

            <h3>Agents</h3>
            <ul>
              <li>Must hold valid real estate license</li>
              <li>Submit to background checks and verification</li>
              <li>Adhere to code of conduct</li>
              <li>Maintain professional liability insurance</li>
            </ul>

            <h2>4. Prohibited Conduct</h2>
            <p>Users may not:</p>
            <ul>
              <li>Provide false or misleading information</li>
              <li>Violate NDA agreements</li>
              <li>Submit fake reviews</li>
              <li>Scrape or automate access to the platform</li>
              <li>Harass or spam other users</li>
              <li>Circumvent security measures</li>
            </ul>

            <h2>5. Subscriptions & Billing</h2>
            <ul>
              <li>Subscriptions renew automatically</li>
              <li>Cancel anytime through account settings</li>
              <li>30-day money-back guarantee for new subscribers</li>
              <li>No refunds for partial billing periods</li>
            </ul>

            <h2>6. Intellectual Property</h2>
            <p>All platform content, design, and code are owned by AgentVault. Users retain ownership of their submitted content.</p>

            <h2>7. Disclaimers</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-semibold">IMPORTANT DISCLAIMERS:</p>
              <ul>
                <li><strong>Not Investment Advice:</strong> AgentVault does not provide financial, legal, or investment advice.</li>
                <li><strong>Not a Broker-Dealer:</strong> We are not licensed brokers and do not facilitate transactions.</li>
                <li><strong>Agent Verification:</strong> While we verify licenses and backgrounds, we cannot guarantee agent performance.</li>
                <li><strong>Platform Availability:</strong> We strive for 99.9% uptime but cannot guarantee uninterrupted service.</li>
              </ul>
            </div>

            <h2>8. Limitation of Liability</h2>
            <p>AgentVault's liability is limited to the amount paid in the last 12 months. We are not liable for indirect, incidental, or consequential damages.</p>

            <h2>9. Indemnification</h2>
            <p>Users agree to indemnify AgentVault against claims arising from their use of the platform or violation of these terms.</p>

            <h2>10. Dispute Resolution</h2>
            <p>Disputes will be resolved through binding arbitration in San Francisco, CA under AAA rules.</p>

            <h2>11. Termination</h2>
            <p>We may suspend or terminate accounts for terms violations. Users may close accounts anytime.</p>

            <h2>12. Changes to Terms</h2>
            <p>We may modify these terms with 30 days notice. Continued use constitutes acceptance.</p>

            <h2>13. Contact</h2>
            <p>
              <strong>Email:</strong> legal@agentvault.com<br />
              <strong>Address:</strong> 123 Main Street, San Francisco, CA 94102
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}