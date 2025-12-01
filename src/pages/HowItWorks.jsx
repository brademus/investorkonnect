import React from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { 
  Shield, CheckCircle, Lock, FileCheck, 
  Users, Star, Search, UserCheck, ArrowRight
} from "lucide-react";

export default function HowItWorks() {
  const navigate = useNavigate(); // Initialize useNavigate

  const APP_URL = "https://agent-vault-da3d088b.base44.app"; // This constant will no longer be used for navigation but is kept if it has other implicit uses

  const investorSteps = [
    {
      icon: Search,
      title: "Sign Up & Browse",
      description: "Create your investor account and browse verified agent profiles filtered by market and specialty."
    },
    {
      icon: FileCheck,
      title: "Sign NDA",
      description: "Sign a legally binding NDA to access protected deal rooms and detailed agent information."
    },
    {
      icon: Users,
      title: "Connect & Collaborate",
      description: "Work directly with vetted agents in secure deal rooms with complete audit trails."
    }
  ];

  const agentSteps = [
    {
      icon: UserCheck,
      title: "Submit Application",
      description: "Complete our application with license verification, references, and track record documentation."
    },
    {
      icon: Shield,
      title: "Multi-Stage Vetting",
      description: "Our team verifies your license, conducts background checks, and validates references."
    },
    {
      icon: Star,
      title: "Get Approved & Featured",
      description: "Once approved, your profile goes live and you gain access to serious investors."
    }
  ];

  const trustStack = [
    {
      title: "Step 1: Verification",
      icon: Shield,
      items: [
        "License verification",
        "Background checks",
        "Reference validation",
        "Track record analysis"
      ]
    },
    {
      title: "Step 2: NDA Protection",
      icon: Lock,
      items: [
        "Legally binding NDAs",
        "DocuSign integration",
        "Automatic enforcement",
        "Audit trail logging"
      ]
    },
    {
      title: "Step 3: Gated Access",
      icon: FileCheck,
      items: [
        "Role-based permissions",
        "Secure deal rooms",
        "Encrypted communications",
        "Complete transparency"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#D3A029]/80 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">How Investor Konnect Works</h1>
          <p className="text-xl text-[#E5E7EB]">
            A three-layer trust system designed to protect investors and empower verified agents.
          </p>
        </div>
      </section>

      {/* For Investors */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#FEF3C7] rounded-full px-4 py-2 mb-4">
              <Users className="w-4 h-4 text-[#D3A029]" />
              <span className="text-sm font-medium text-[#92400E]">For Investors</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4">
              Find Verified Agents in 3 Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {investorSteps.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="rounded-3xl border border-[#E5E7EB] bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] p-8 shadow-xl h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-[#D3A029] rounded-xl flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-[#D3A029]">{idx + 1}</div>
                  </div>
                  <h3 className="text-xl font-bold text-[#111827] mb-3">{step.title}</h3>
                  <p className="text-[#4B5563] leading-relaxed">{step.description}</p>
                </div>
                {idx < investorSteps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-[#D3A029]/50 -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button 
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5"
              onClick={() => navigate(createPageUrl("Investors"))}
            >
              Explore Investor Features
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* For Agents */}
      <section className="py-20 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-[#D1FAE5] rounded-full px-4 py-2 mb-4">
              <Shield className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium text-[#065F46]">For Agents</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4">
              Join Our Verified Network
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {agentSteps.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-xl h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-[#10B981] rounded-xl flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-[#10B981]">{idx + 1}</div>
                  </div>
                  <h3 className="text-xl font-bold text-[#111827] mb-3">{step.title}</h3>
                  <p className="text-[#4B5563] leading-relaxed">{step.description}</p>
                </div>
                {idx < agentSteps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-[#10B981]/50 -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button 
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#10B981] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#10B981]/30 transition-all hover:bg-[#059669] hover:shadow-xl hover:-translate-y-0.5"
              onClick={() => navigate(createPageUrl("Agents"))}
            >
              Apply as an Agent
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Trust Stack */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4">
              The Trust Stack
            </h2>
            <p className="text-xl text-[#6B7280] max-w-2xl mx-auto">
              Three layers of protection prevent deal manipulation and secure your investments.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {trustStack.map((layer) => (
              <div key={layer.title} className="rounded-3xl border border-[#E5E7EB] bg-gradient-to-br from-[#F9FAFB] to-white p-8 shadow-xl">
                <div className="w-14 h-14 bg-gradient-to-br from-[#D3A029] to-[#B98413] rounded-xl flex items-center justify-center mb-6">
                  <layer.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-[#111827] mb-6">{layer.title}</h3>
                <ul className="space-y-3">
                  {layer.items.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-[#D3A029] flex-shrink-0" />
                      <span className="text-[#4B5563]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#D3A029]/80 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-[#E5E7EB] mb-8">
            Join Investor Konnect today and experience the future of secure real estate connections.
          </p>
          <button 
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5"
            onClick={() => navigate(createPageUrl("Pricing"))}
          >
            Start Your Journey
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}