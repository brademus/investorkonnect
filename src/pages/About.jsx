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
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">About Investor Konnect</h1>
          <p className="text-xl text-slate-300">
            We're building the most trusted network of investor-focused real estate agents.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">Our Mission</h2>
          <p className="text-lg text-slate-700 leading-relaxed mb-6">
            Real estate investing shouldn't require blind trust. Yet too often, investors work with agents who prioritize commissions over client interests, share confidential deal information, or provide misleading market analysis.
          </p>
          <p className="text-lg text-slate-700 leading-relaxed mb-6">
            Investor Konnect was founded to solve this problem. We combine rigorous agent vetting, platform-verified reviews, and NDA-protected deal rooms to create a network where trust isn't assumed — it's engineered.
          </p>
          <p className="text-lg text-slate-700 leading-relaxed">
            Our goal is simple: make it easy for investors to find agents who will protect their interests, and help those agents build reputations based on real performance, not fake reviews.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div key={value.title} className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{value.title}</h3>
                <p className="text-slate-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team (Placeholder) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Built by Investors, For Investors</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-12">
            Our team has decades of combined experience in real estate investing, software engineering, and security. We've felt the pain of unreliable agents and built the solution we wish existed.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Join Our Mission
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Whether you're an investor or agent, be part of a more trustworthy real estate ecosystem.
          </p>
          <Link to={createPageUrl("Onboard")}>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 h-14">
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}