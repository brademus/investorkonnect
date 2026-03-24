import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

export default function Terms() {
  useEffect(() => {
    document.title = 'Terms of Use - Investor Konnect';
  }, []);

  return (
    <div className="min-h-screen bg-transparent py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link 
          to={createPageUrl('Dashboard')} 
          className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-[#E3C567] mb-2">Terms of Use</h1>
          <p className="text-sm text-[#808080] mb-8">
            Effective Date: January 1, 2026<br />
            Last Updated: March 1, 2026
          </p>

          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[#FAFAFA]">
            <p>
              These Terms of Use ("Terms") govern your access to and use of the Investor Konnect platform ("Platform," "we," "us," or "our"), including our website, web application, and any related services (collectively, the "Services"). By creating an account or using the Services, you agree to these Terms. If you do not agree, do not use the Services.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">1. Who Can Use the Platform</h2>
            <p>You must be at least 18 years old and legally capable of entering into binding contracts to use the Services. By using the Platform, you represent that you meet these requirements.</p>
            <p>The Platform serves two user types:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Investors:</strong> individuals or entities seeking to work with licensed real estate agents on property transactions.</li>
              <li><strong>Agents:</strong> licensed real estate professionals who receive and respond to deal invitations from Investors.</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">2. Account Registration</h2>
            <p>You must create an account to use the Services. You agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>provide accurate and complete registration information;</li>
              <li>keep your account credentials confidential;</li>
              <li>notify us immediately of any unauthorized access to your account; and</li>
              <li>be responsible for all activity that occurs under your account.</li>
            </ul>
            <p>We reserve the right to suspend or terminate accounts that contain inaccurate information or that violate these Terms.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">3. Agent Eligibility and Verification</h2>
            <p>Agents must hold a valid real estate license in the state(s) where they practice. By registering as an Agent, you represent that your license is current and in good standing. We may verify your license information and reserve the right to remove Agents whose licenses are expired, suspended, or revoked.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">4. How the Platform Works</h2>
            <p>Investor Konnect facilitates connections between Investors and Agents for real estate transactions. The Platform enables:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>deal creation and agent matching;</li>
              <li>in-app messaging between matched parties;</li>
              <li>agreement generation and electronic signing via integrated e-signature services;</li>
              <li>document exchange, walkthrough scheduling, and deal tracking; and</li>
              <li>reviews and performance tracking.</li>
            </ul>
            <p>We are a technology platform only. We do not act as a real estate broker, agent, or advisor. All real estate decisions, negotiations, and transactions are solely between Investors and Agents.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">5. Agreements and Electronic Signatures</h2>
            <p>The Platform generates agreements between Investors and Agents based on information you provide. These agreements are routed through a third-party e-signature provider (DocuSign). By signing an agreement through the Platform, you:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>acknowledge that your electronic signature is legally binding to the same extent as a handwritten signature under applicable law, including the Electronic Signatures in Global and National Commerce Act (ESIGN) and the Uniform Electronic Transactions Act (UETA);</li>
              <li>confirm you have reviewed and understood the agreement before signing; and</li>
              <li>agree that a fully executed copy may be stored on the Platform and with the e-signature provider.</li>
            </ul>
            <p>We are not a party to any agreement between Investors and Agents. We are not responsible for the performance, breach, or disputes arising from those agreements.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">6. Subscriptions and Payments</h2>
            <p>Access to certain features of the Platform requires a paid subscription. Subscriptions are billed on a recurring monthly or annual basis through our payment processor (Stripe). By subscribing, you authorize us to charge your payment method on a recurring basis until you cancel.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Free trial:</strong> We may offer a free trial period. At the end of the trial, your subscription will automatically convert to a paid plan unless you cancel before the trial ends.</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial billing periods.</li>
              <li><strong>Price changes:</strong> We may change subscription pricing with reasonable notice. Continued use after a price change constitutes acceptance of the new price.</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>use the Platform for any unlawful purpose or in violation of any applicable law or regulation;</li>
              <li>misrepresent your identity, credentials, or license status;</li>
              <li>attempt to circumvent platform fees, matching rules, or agreement workflows;</li>
              <li>harass, threaten, or abuse other users;</li>
              <li>upload or transmit malicious code, spam, or unauthorized advertising;</li>
              <li>scrape, reverse-engineer, or copy any part of the Platform; or</li>
              <li>use the Platform to solicit users to transact outside the Platform in a way that circumvents our Terms.</li>
            </ul>
            <p>We reserve the right to suspend or terminate any account that violates these rules, at our sole discretion and without prior notice.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">8. Identity Verification</h2>
            <p>We may require identity verification before granting full access to Platform features. Verification is performed through third-party identity verification services. By submitting verification information, you consent to that information being processed by our verification provider in accordance with their terms and privacy policy.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">9. Content and Intellectual Property</h2>
            <p>All Platform content, including design, code, text, graphics, and trademarks, is owned by or licensed to Investor Konnect and is protected by applicable intellectual property laws. You may not copy, distribute, or create derivative works from any Platform content without our express written permission.</p>
            <p>You retain ownership of content you upload to the Platform (e.g., documents, deal information). By uploading content, you grant us a limited license to store, display, and process it as necessary to provide the Services.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">10. Disclaimer of Warranties</h2>
            <p>THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">11. Limitation of Liability</h2>
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, INVESTOR KONNECT AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICES, INCLUDING LOST PROFITS, DATA LOSS, OR BUSINESS INTERRUPTION, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p>OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICES SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">12. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Investor Konnect and its officers, directors, employees, and agents from any claims, damages, losses, or costs (including reasonable attorneys' fees) arising from: (a) your use of the Services; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; or (d) any dispute between you and another user.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">13. Termination</h2>
            <p>We may suspend or terminate your access to the Services at any time, with or without cause, and with or without notice. You may terminate your account at any time by contacting us or using account settings. Upon termination, your right to use the Services ceases immediately.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">14. Governing Law and Disputes</h2>
            <p>These Terms are governed by the laws of the State of [STATE TBD], without regard to conflict of law principles. Any disputes arising from these Terms or the Services shall be resolved through binding arbitration under the rules of the American Arbitration Association, except that either party may seek injunctive relief in a court of competent jurisdiction for intellectual property violations.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">15. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms and revising the "Last Updated" date. Continued use of the Services after changes take effect constitutes acceptance of the revised Terms.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">16. Contact</h2>
            <p>Questions about these Terms? Contact us:</p>
            <p className="mt-3">
              <strong>Investor Konnect Support</strong><br />
              Email: support@investorkonnect.com<br />
              Address: [Business Address TBD]
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}