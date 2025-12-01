import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Shield, Target, Users, Heart, ArrowRight } from "lucide-react";

export default function About() {
  const values = [
    {
      icon: Shield,
      title: "Trust First",
      description: "Every feature designed with security and transparency as the foundation."
    },
    {
      icon: Target,
      title: "Investor Protection",
      description: "We exist to prevent deal manipulation and protect investor interests."
    },
    {
      icon: Users,
      title: "Quality Over Quantity",
      description: "Rigorous agent vetting means only the best make it onto our platform."
    },
    {
      icon: Heart,
      title: "Long-term Relationships",
      description: "Building lasting connections between investors and agents, not one-off transactions."
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#D3A029]/80 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">About Investor Konnect</h1>
          <p className="text-xl text-[#E5E7EB]">
            We're building the most trusted network of investor-focused real estate agents.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#111827] mb-6 text-center">Our Mission</h2>
          <p className="text-lg text-[#4B5563] leading-relaxed mb-6">
            Real estate investing shouldn't require blind trust. Yet too often, investors work with agents who prioritize commissions over client interests, share confidential deal information, or provide misleading market analysis.
          </p>
          <p className="text-lg text-[#4B5563] leading-relaxed mb-6">
            Investor Konnect was founded to solve this problem. We combine rigorous agent vetting, platform-verified reviews, and NDA-protected deal rooms to create a network where trust isn't assumed — it's engineered.
          </p>
          <p className="text-lg text-[#4B5563] leading-relaxed">
            Our goal is simple: make it easy for investors to find agents who will protect their interests, and help those agents build reputations based on real performance, not fake reviews.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#111827] mb-12 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div key={value.title} className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200">
                <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-[#D3A029]" />
                </div>
                <h3 className="text-lg font-bold text-[#111827] mb-3">{value.title}</h3>
                <p className="text-[#6B7280]">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team (Placeholder) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-[#111827] mb-6">Built by Investors, For Investors</h2>
          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto mb-12">
            Our team has decades of combined experience in real estate investing, software engineering, and security. We've felt the pain of unreliable agents and built the solution we wish existed.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#D3A029]/80 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Join Our Mission
          </h2>
          <p className="text-xl text-[#E5E7EB] mb-8">
            Whether you're an investor or agent, be part of a more trustworthy real estate ecosystem.
          </p>
          <Link to={createPageUrl("RoleSelection")}>
            <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:shadow-[#D3A029]/40 hover:-translate-y-0.5">
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}