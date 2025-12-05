import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { 
  Shield, CheckCircle, Star, Users, 
  TrendingUp, Lock, ArrowRight, FileCheck
} from "lucide-react";

/**
 * AGENTS MARKETING PAGE
 * 
 * Public marketing page for agents to learn about the platform.
 * NOT the agent directory - that's AgentDirectory.jsx
 */
export default function Agents() {
  const navigate = useNavigate();

  const vettingChecklist = [
    "Valid real estate license in good standing",
    "Clean background check (no fraud, theft, or serious violations)",
    "Minimum 2 professional references from investors",
    "Documented track record of 5+ investor transactions",
    "Completion of platform code of conduct training",
    "Agreement to NDA requirements and audit trail logging"
  ];

  const benefits = [
    {
      icon: Users,
      title: "Access Serious Investors",
      description: "Connect with pre-qualified investors who are ready to transact, not tire-kickers."
    },
    {
      icon: Star,
      title: "Build Verified Reputation",
      description: "Earn platform-verified reviews that can't be faked or manipulated."
    },
    {
      icon: Lock,
      title: "Protected Communications",
      description: "All interactions are logged and protected, giving you and investors peace of mind."
    },
    {
      icon: TrendingUp,
      title: "Free Membership",
      description: "No fees for agents. We charge investors, not you. Focus on what you do best."
    }
  ];

  const codeOfConduct = [
    "Always act in the investor's best interest",
    "Disclose all potential conflicts of interest upfront",
    "Provide accurate market data and comps",
    "Never pressure investors into rushed decisions",
    "Honor all NDA agreements and confidentiality",
    "Maintain professional communication at all times"
  ];

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0F0F0F] via-[#1A1A1A] to-[#E5C37F]/20 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#34D399]/20 border border-[#34D399]/30 rounded-full px-4 py-2 mb-6">
                <Shield className="w-4 h-4 text-[#34D399]" />
                <span className="text-sm text-[#34D399]">For Real Estate Agents</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight text-[#E5C37F]">
                Join a Selective Network of Investor-Focused Agents
              </h1>
              <p className="text-xl text-[#A6A6A6] mb-8">
                Pass our rigorous vetting process and gain access to serious, pre-qualified investors. Free membership with verified reviews.
              </p>
              <button 
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981] px-8 py-4 text-base font-semibold text-[#0F0F0F] shadow-lg shadow-[#34D399]/30 transition-all hover:from-[#6EE7B7] hover:to-[#34D399] hover:shadow-xl hover:-translate-y-0.5"
                onClick={() => navigate(createPageUrl("RoleSelection"))}
              >
                Apply Now
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#1A1A1A]/80 backdrop-blur-sm border border-[#333333] rounded-3xl p-8">
              <h3 className="text-2xl font-bold mb-6 text-[#E5C37F]">Vetting Checklist</h3>
              <ul className="space-y-4">
                {vettingChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <FileCheck className="w-5 h-5 text-[#34D399] mt-0.5 flex-shrink-0" />
                    <span className="text-[#A6A6A6]">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-[#A6A6A6] mt-6">
                Approval rate: ~20%. We maintain high standards to protect investor trust.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-[#0F0F0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#E5C37F] mb-4">
              Why Join Investor Konnect?
            </h2>
            <p className="text-xl text-[#A6A6A6] max-w-2xl mx-auto">
              Stand out in a crowded market by being part of a verified, trusted network.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title}
                className="rounded-3xl border border-[#333333] bg-[#1A1A1A] p-8 shadow-xl hover:shadow-[0_10px_25px_rgba(52,211,153,0.2)] hover:border-[#34D399] hover:-translate-y-1 transition-all"
              >
                <div className="w-12 h-12 bg-[#34D399]/20 rounded-xl flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-[#34D399]" />
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">{benefit.title}</h3>
                <p className="text-[#A6A6A6] leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application Steps */}
      <section className="py-20 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#E5C37F] mb-12 text-center">
            Application Process
          </h2>
          <div className="space-y-6">
            <div className="rounded-3xl border border-[#333333] bg-[#1A1A1A] p-6 shadow-xl flex items-start gap-4">
              <div className="w-10 h-10 bg-[#34D399] text-[#0F0F0F] rounded-xl flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">Submit Your Application</h3>
                <p className="text-[#A6A6A6]">
                  Complete the online form with your license information, references, and transaction history. Takes about 10 minutes.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-[#333333] bg-[#1A1A1A] p-6 shadow-xl flex items-start gap-4">
              <div className="w-10 h-10 bg-[#34D399] text-[#0F0F0F] rounded-xl flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">Verification Process</h3>
                <p className="text-[#A6A6A6]">
                  Our team verifies your license, conducts background checks, and contacts your references. Usually takes 3-5 business days.
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-[#333333] bg-[#1A1A1A] p-6 shadow-xl flex items-start gap-4">
              <div className="w-10 h-10 bg-[#34D399] text-[#0F0F0F] rounded-xl flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">Approval & Onboarding</h3>
                <p className="text-[#A6A6A6]">
                  Once approved, complete profile setup, sign platform agreements, and you're live. Start connecting with investors immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Code of Conduct */}
      <section className="py-20 bg-[#0F0F0F]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#E5C37F] mb-4">
              Code of Conduct
            </h2>
            <p className="text-lg text-[#A6A6A6]">
              All agents agree to these principles. Violations result in immediate removal.
            </p>
          </div>
          <div className="rounded-3xl border border-[#333333] bg-[#1A1A1A] p-8 shadow-xl">
            <ul className="space-y-4">
              {codeOfConduct.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#34D399] mt-0.5 flex-shrink-0" />
                  <span className="text-[#A6A6A6] text-lg">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#E5C37F]">
            Ready to Join?
          </h2>
          <p className="text-xl text-[#A6A6A6] mb-8">
            Apply today and become part of the most trusted network of investor-focused agents.
          </p>
          <button 
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981] px-8 py-4 text-lg font-semibold text-[#0F0F0F] shadow-lg shadow-[#34D399]/30 transition-all hover:from-[#6EE7B7] hover:to-[#34D399] hover:shadow-xl hover:-translate-y-0.5"
            onClick={() => navigate(createPageUrl("RoleSelection"))}
          >
            Start Your Application
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}