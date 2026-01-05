import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

export default function Privacy() {
  useEffect(() => {
    document.title = 'Privacy Policy - Investor Konnect';
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
          <h1 className="text-3xl md:text-4xl font-bold text-[#E3C567] mb-2">Privacy Policy</h1>
          <p className="text-sm text-[#808080] mb-8">
            Effective Date: January 1, 2026<br />
            Last Updated: January 1, 2026
          </p>

          <div className="prose prose-invert prose-sm max-w-none space-y-6 text-[#FAFAFA]">
            <p>
              InvestorKonnect ("InvestorKonnect," "we," "us," or "our") provides a platform that connects real estate investors and licensed real estate agents to collaborate on property disposition workflows, including communications, document exchange, agreement generation, and electronic signing (the "Services"). This Privacy Policy explains how we collect, use, disclose, and protect information when you access or use our Services.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">1. Scope</h2>
            <p>This Privacy Policy applies to information we collect through:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>our website and web application;</li>
              <li>our communications and support channels; and</li>
              <li>integrations we use to provide the Services (including e-signature and file storage).</li>
            </ul>
            <p>It does not apply to third-party websites, services, or platforms that may be linked from the Services.</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-[#FAFAFA] mt-6 mb-3">A. Information you provide</h3>
            <p>We may collect information you provide directly, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account information:</strong> name, email address, password or authentication token (if applicable), user role (Investor or Agent), and profile details.</li>
              <li><strong>Professional information (Agents):</strong> brokerage name, license number, license state(s), and related verification information.</li>
              <li><strong>Deal information:</strong> deal identifiers, property city/state, transaction type, terms you input (e.g., compensation structure), and other deal metadata.</li>
              <li><strong>Communications:</strong> messages and attachments sent through in-app chat, comments, and support requests.</li>
              <li><strong>Documents and files:</strong> contracts, addenda, disclosures, photos, and other documents uploaded to the platform.</li>
              <li><strong>Signature-related information:</strong> information required to generate and route agreements for signing (e.g., signer name/email).</li>
            </ul>

            <h3 className="text-lg font-semibold text-[#FAFAFA] mt-6 mb-3">B. Information collected automatically</h3>
            <p>When you use our Services, we may collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Device and usage data:</strong> IP address, browser type, device identifiers, operating system, app activity, and pages/actions within the app.</li>
              <li><strong>Log and diagnostic data:</strong> error logs, audit events, and security events.</li>
            </ul>

            <h3 className="text-lg font-semibold text-[#FAFAFA] mt-6 mb-3">C. Information from third parties</h3>
            <p>We may receive information from:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>E-signature providers (e.g., DocuSign) about envelope status (sent, viewed, signed, completed, declined, voided) and related metadata.</li>
              <li>Service providers that help us operate the platform (e.g., hosting, storage, analytics).</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">3. How We Use Information</h2>
            <p>We use information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and operate the Services (account access, deal workflows, chat, document exchange, contract generation, and signing).</li>
              <li>Enable e-signature by preparing agreements and routing them to signers via DocuSign (or another e-sign provider).</li>
              <li>Protect the platform by preventing fraud, abuse, circumvention, and unauthorized access; enforcing our Terms; and maintaining audit logs.</li>
              <li>Improve and debug the Services, including performance monitoring and error resolution.</li>
              <li>Communicate with you about service updates, security notices, and support.</li>
              <li>Comply with legal obligations and respond to lawful requests.</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">4. How We Share Information</h2>
            
            <h3 className="text-lg font-semibold text-[#FAFAFA] mt-6 mb-3">A. With other users (Investor ↔ Agent)</h3>
            <p>
              The platform is designed for collaboration. Depending on workflow stage and permission settings, you may share certain deal details and documents with the counterparty. We may restrict access to certain sensitive details until agreements are signed, depending on system rules.
            </p>

            <h3 className="text-lg font-semibold text-[#FAFAFA] mt-6 mb-3">B. With service providers</h3>
            <p>We use third-party vendors to operate the Services, such as:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Hosting and database providers (e.g., Supabase),</li>
              <li>File storage for documents and uploads,</li>
              <li>E-signature providers (e.g., DocuSign) to route agreements and collect signatures.</li>
            </ul>
            <p>These providers process data on our behalf under contractual obligations appropriate to their role.</p>

            <h3 className="text-lg font-semibold text-[#FAFAFA] mt-6 mb-3">C. For legal, compliance, and safety reasons</h3>
            <p>We may disclose information if we believe it is necessary to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>comply with applicable law or legal process;</li>
              <li>protect the safety, rights, or property of users or InvestorKonnect;</li>
              <li>investigate fraud or security issues; or</li>
              <li>enforce our Terms.</li>
            </ul>

            <h3 className="text-lg font-semibold text-[#FAFAFA] mt-6 mb-3">D. Business transfers</h3>
            <p>
              If we undergo a merger, acquisition, or asset sale, information may be transferred as part of that transaction.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">5. E-Signature and Legal Documents</h2>
            <p>When you use "Generate Agreement" and related signing features:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>we may transmit the agreement and signer details (name/email and routing data) to DocuSign to enable signing;</li>
              <li>we receive and store envelope status updates; and</li>
              <li>we may store a copy of the completed agreement and relevant audit metadata (e.g., timestamps, envelope IDs, integrity hashes) for recordkeeping.</li>
            </ul>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">6. Data Retention</h2>
            <p>We retain information for as long as necessary to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>provide the Services;</li>
              <li>maintain records for compliance, dispute resolution, and auditability; and</li>
              <li>meet legal and contractual requirements.</li>
            </ul>
            <p>Retention periods may vary by data type (e.g., agreements and audit logs may be retained longer than general usage logs).</p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">7. Security</h2>
            <p>
              We implement administrative, technical, and physical safeguards designed to protect information. However, no system is completely secure. You are responsible for maintaining the confidentiality of your credentials and for notifying us of any suspected unauthorized access.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">8. Your Choices and Rights</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>access, correct, or delete certain personal information;</li>
              <li>object to or restrict processing; and</li>
              <li>request a copy of your data.</li>
            </ul>
            <p>
              To exercise these rights, contact us using the information in Section 12. We may need to verify your identity.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">9. Cookies and Similar Technologies</h2>
            <p>We may use cookies or similar technologies for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>authentication and session management;</li>
              <li>security; and</li>
              <li>analytics and performance measurement.</li>
            </ul>
            <p>
              You can manage cookies via your browser settings. Some features may not function if cookies are disabled.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">10. Children</h2>
            <p>
              InvestorKonnect is not intended for children under 18, and we do not knowingly collect personal information from children.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">11. International Users</h2>
            <p>
              If you access the Services from outside the United States, your information may be processed and stored in the United States or other jurisdictions where our service providers operate.
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">12. Contact Us</h2>
            <p>If you have questions or requests regarding this Privacy Policy, contact:</p>
            <p className="mt-3">
              <strong>InvestorKonnect Support</strong><br />
              Email: support@investorkonnect.com<br />
              Address: [Business Address TBD]
            </p>

            <h2 className="text-xl font-semibold text-[#E3C567] mt-8 mb-4">13. Changes to this Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated version and revise the "Last Updated" date. If changes are material, we may provide additional notice as required by law.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}