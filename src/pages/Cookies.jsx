import React from "react";
import { Cookie } from "lucide-react";

export default function Cookies() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <Cookie className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Cookie Policy</h1>
          </div>

          <p className="text-lg text-slate-600 mb-8">
            We use minimal cookies to provide essential functionality. No advertising or tracking cookies.
          </p>

          <div className="prose prose-slate max-w-none">
            <h2>What Are Cookies?</h2>
            <p>Cookies are small text files stored on your device to help websites function and improve user experience.</p>

            <h2>Cookies We Use</h2>
            
            <h3>Essential Cookies (Required)</h3>
            <p>These cookies are necessary for the platform to function:</p>
            <ul>
              <li><strong>Authentication:</strong> Keeps you logged in</li>
              <li><strong>Session Management:</strong> Maintains your session state</li>
              <li><strong>Security:</strong> Prevents CSRF attacks and ensures secure connections</li>
            </ul>
            <p className="text-sm text-slate-600">Duration: Session or up to 30 days</p>

            <h3>Preference Cookies (Optional)</h3>
            <p>These remember your choices:</p>
            <ul>
              <li>Language preference</li>
              <li>Display settings</li>
              <li>Cookie consent choices</li>
            </ul>
            <p className="text-sm text-slate-600">Duration: Up to 1 year</p>

            <h3>Analytics Cookies (Optional)</h3>
            <p>These help us understand usage patterns:</p>
            <ul>
              <li>Page views and navigation</li>
              <li>Feature usage</li>
              <li>Performance metrics</li>
            </ul>
            <p className="text-sm text-slate-600">Duration: Up to 2 years</p>

            <h2>Cookies We DO NOT Use</h2>
            <ul>
              <li>❌ Advertising/tracking cookies</li>
              <li>❌ Third-party marketing cookies</li>
              <li>❌ Social media tracking pixels</li>
              <li>❌ Cross-site tracking cookies</li>
            </ul>

            <h2>Managing Cookies</h2>
            <p>You can control cookies through:</p>
            <ol>
              <li><strong>Browser Settings:</strong> Most browsers allow you to block or delete cookies</li>
              <li><strong>Platform Settings:</strong> Adjust preferences in your account settings</li>
              <li><strong>Opt-Out:</strong> Disable non-essential cookies</li>
            </ol>

            <p className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <strong>Note:</strong> Blocking essential cookies will prevent you from using Investor Konnect.
            </p>

            <h2>Third-Party Services</h2>
            <p>We use these third-party services that may set cookies:</p>
            <ul>
              <li><strong>Stripe:</strong> Payment processing (essential)</li>
              <li><strong>DocuSign:</strong> NDA signing (essential)</li>
              <li><strong>AWS:</strong> Hosting infrastructure (essential)</li>
            </ul>
            <p>These services have their own privacy policies.</p>

            <h2>Updates to This Policy</h2>
            <p>We may update this policy and will notify you of material changes.</p>

            <h2>Questions?</h2>
            <p>Contact us at <a href="mailto:privacy@investorkonnect.com">privacy@investorkonnect.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}