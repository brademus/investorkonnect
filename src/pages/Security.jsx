import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { 
  Shield, Lock, FileText, Eye, AlertTriangle, 
  Server, CheckCircle, Mail
} from "lucide-react";

export default function Security() {
  const securityFeatures = [
    {
      icon: Lock,
      title: "256-bit Encryption",
      description: "All data encrypted at rest and in transit using industry-standard AES-256 encryption."
    },
    {
      icon: Shield,
      title: "SOC 2 Compliance",
      description: "Regular third-party audits ensure our security practices meet the highest standards."
    },
    {
      icon: Server,
      title: "Infrastructure Security",
      description: "Hosted on AWS with redundant backups, DDoS protection, and 99.9% uptime SLA."
    },
    {
      icon: Eye,
      title: "Complete Audit Trails",
      description: "Every action is logged with timestamps, IP addresses (masked), and user identifiers."
    },
    {
      icon: FileText,
      title: "NDA Enforcement",
      description: "Legally binding NDAs protect all deal information with automatic access control."
    },
    {
      icon: AlertTriangle,
      title: "Rate Limiting & Abuse Prevention",
      description: "Automated systems detect and prevent suspicious activity, scraping, and abuse."
    }
  ];

  const dataHandling = [
    {
      title: "Data Collection",
      items: [
        "We collect only essential information for platform operation",
        "No third-party tracking or advertising cookies",
        "Clear consent required for all data collection"
      ]
    },
    {
      title: "Data Storage",
      items: [
        "Encrypted at rest using AES-256",
        "Stored in secure, compliant data centers",
        "Regular automated backups with encryption"
      ]
    },
    {
      title: "Data Access",
      items: [
        "Role-based access controls (RBAC)",
        "Multi-factor authentication available",
        "All access logged and monitored"
      ]
    },
    {
      title: "Data Retention",
      items: [
        "Active accounts: retained indefinitely",
        "Deleted accounts: 30-day grace period, then permanent deletion",
        "Transaction logs: 7 years for compliance"
      ]
    }
  ];

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-6 text-blue-400" />
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Enterprise-Grade Security</h1>
          <p className="text-xl text-slate-300">
            Your data and deal information protected by industry-leading security practices.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
            Security Posture
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {securityFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="bg-slate-50 rounded-xl p-8 border border-slate-200"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Handling */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
            How We Handle Your Data
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {dataHandling.map((section) => (
              <div key={section.title} className="bg-white rounded-xl p-8 border border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 mb-6">{section.title}</h3>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance & Certifications */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">
            Compliance & Certifications
          </h2>
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">SOC 2 Type II Compliant</strong>
                  <p className="text-slate-600 text-sm mt-1">Annual audits by independent third parties</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">GDPR Ready</strong>
                  <p className="text-slate-600 text-sm mt-1">Full compliance with European data protection regulations</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">CCPA Compliant</strong>
                  <p className="text-slate-600 text-sm mt-1">California Consumer Privacy Act compliance</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Regular Penetration Testing</strong>
                  <p className="text-slate-600 text-sm mt-1">Quarterly security assessments by certified professionals</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Incident Response */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">
            Security Incident Response
          </h2>
          <div className="bg-white rounded-2xl p-8 border border-slate-200">
            <p className="text-slate-700 mb-6 leading-relaxed">
              We take security incidents seriously. Our incident response team monitors systems 24/7 and follows a comprehensive incident response plan.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Report a Security Issue
              </h3>
              <p className="text-slate-700 mb-3">
                If you discover a security vulnerability, please report it immediately to:
              </p>
              <a 
                href="mailto:security@agentvault.com" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                security@agentvault.com
              </a>
            </div>
            <p className="text-sm text-slate-600">
              We'll acknowledge your report within 24 hours and provide updates as we investigate. We appreciate responsible disclosure and may offer recognition for valid reports.
            </p>
          </div>
        </div>
      </section>

      {/* Abuse Policy */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 text-center">
            Abuse & Rate Limit Policy
          </h2>
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <ul className="space-y-4 text-slate-700">
              <li className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Automated Scraping:</strong> Prohibited. Rate limits enforced on all endpoints.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Review Manipulation:</strong> Fake reviews result in immediate account termination and potential legal action.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>NDA Violations:</strong> Sharing protected deal information is a breach of contract with legal consequences.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Spam & Harassment:</strong> Zero tolerance policy. First violation results in immediate suspension.
                </div>
              </li>
            </ul>
            <p className="text-sm text-slate-600 mt-6">
              To report abuse: <a href="mailto:security@agentvault.com" className="text-blue-600 hover:text-blue-700">security@agentvault.com</a>
            </p>
          </div>
        </div>
      </section>

      {/* Your Rights */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Your Data Rights
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            You have the right to access, export, or delete your data at any time.
          </p>
          <Link to={createPageUrl("Contact")}>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
              Request Data Deletion
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}