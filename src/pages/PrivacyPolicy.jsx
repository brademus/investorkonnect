import React from "react";
import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Privacy Policy</h1>
          </div>

          <p className="text-sm text-slate-600 mb-8">Last Updated: January 1, 2025</p>

          <div className="prose prose-slate max-w-none">
            <h2>1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including:</p>
            <ul>
              <li>Account information (name, email, phone)</li>
              <li>Profile details (location, markets, specialties)</li>
              <li>License information (for agents)</li>
              <li>Transaction data and communications</li>
              <li>Usage data and analytics</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
              <li>Provide and maintain our services</li>
              <li>Verify agent credentials and investor identity</li>
              <li>Facilitate secure connections and transactions</li>
              <li>Enforce NDAs and platform policies</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul>
              <li>Other platform users (as permitted by platform features)</li>
              <li>Service providers who assist our operations</li>
              <li>Law enforcement when required by law</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>We employ industry-standard security measures including:</p>
            <ul>
              <li>256-bit AES encryption at rest and in transit</li>
              <li>Regular security audits and penetration testing</li>
              <li>Role-based access controls</li>
              <li>Complete audit trails of all access</li>
            </ul>

            <h2>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your data</li>
              <li>Opt-out of marketing communications</li>
            </ul>

            <h2>6. Data Retention</h2>
            <p>We retain your data as long as your account is active. After account deletion, data is retained for 30 days then permanently deleted, except transaction logs (kept 7 years for compliance).</p>

            <h2>7. Cookies</h2>
            <p>We use essential cookies for authentication and preferences. No advertising or third-party tracking cookies.</p>

            <h2>8. Children's Privacy</h2>
            <p>Our services are not intended for users under 18. We do not knowingly collect information from children.</p>

            <h2>9. Changes to This Policy</h2>
            <p>We may update this policy and will notify users of material changes via email.</p>

            <h2>10. Contact Us</h2>
            <p>Questions about privacy? Contact us at:</p>
            <p>
              <strong>Email:</strong> privacy@agentvault.com<br />
              <strong>Address:</strong> 123 Main Street, San Francisco, CA 94102
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mt-8">
              <p className="text-sm text-slate-700 mb-0">
                <strong>GDPR & CCPA Compliance:</strong> We comply with GDPR and CCPA regulations. European and California users have additional rights under these laws. Contact privacy@agentvault.com for requests.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}