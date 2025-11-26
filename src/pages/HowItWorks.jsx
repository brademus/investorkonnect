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
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">How Investor Konnect Works</h1>
          <p className="text-xl text-slate-300">
            A three-layer trust system designed to protect investors and empower verified agents.
          </p>
        </div>
      </section>

      {/* For Investors */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-100 rounded-full px-4 py-2 mb-4">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">For Investors</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Find Verified Agents in 3 Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {investorSteps.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200 h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-blue-600">{idx + 1}</div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{step.description}</p>
                </div>
                {idx < investorSteps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-blue-300 -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate(createPageUrl("Investors"))} // Use navigate
            >
              Explore Investor Features
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* For Agents */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-emerald-100 rounded-full px-4 py-2 mb-4">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-900">For Agents</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Join Our Verified Network
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {agentSteps.map((step, idx) => (
              <div key={step.title} className="relative">
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-emerald-600">{idx + 1}</div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{step.description}</p>
                </div>
                {idx < agentSteps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-emerald-300 -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => navigate(createPageUrl("Agents"))} // Use navigate
            >
              Apply as an Agent
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Trust Stack */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              The Trust Stack
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Three layers of protection prevent deal manipulation and secure your investments.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {trustStack.map((layer) => (
              <div key={layer.title} className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl flex items-center justify-center mb-6">
                  <layer.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-6">{layer.title}</h3>
                <ul className="space-y-3">
                  {layer.items.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join Investor Konnect today and experience the future of secure real estate connections.
          </p>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 h-14"
            onClick={() => navigate(createPageUrl("Pricing"))} // Use navigate for Pricing page
          >
            Start Your Journey
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}