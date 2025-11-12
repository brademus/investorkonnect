import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { 
  Shield, Star, Lock, FileText, Users, 
  TrendingUp, CheckCircle, ArrowRight, Zap
} from "lucide-react";

/**
 * INVESTORS MARKETING PAGE
 * 
 * Public marketing page for investors to learn about the platform.
 * NOT the investor directory - that's InvestorDirectory.jsx
 */
export default function Investors() {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Shield,
      title: "Multi-Stage Agent Vetting",
      description: "Every agent undergoes license verification, background checks, reference validation, and track record analysis before approval."
    },
    {
      icon: Star,
      title: "Platform-Verified Reviews",
      description: "Only verified investors who completed transactions can leave reviews. No fake reviews, no manipulation."
    },
    {
      icon: Lock,
      title: "NDA-Protected Deal Rooms",
      description: "All deal information is protected by legally binding NDAs. Share confidently knowing your information is secure."
    },
    {
      icon: FileText,
      title: "Complete Audit Trails",
      description: "Every message, document access, and interaction is logged for compliance and security."
    },
    {
      icon: Users,
      title: "Investor-First Network",
      description: "Agents are selected specifically for their track record of protecting investor interests and delivering results."
    },
    {
      icon: Zap,
      title: "Instant Market Access",
      description: "Connect with pre-vetted agents in your target markets within minutes. No more cold calls or questionable referrals."
    }
  ];

  const features = [
    "Search agents by market, specialty, and track record",
    "View verified reviews from real investors",
    "Secure messaging with end-to-end encryption",
    "Deal room collaboration with document sharing",
    "Transaction tracking and milestone management",
    "Direct calendar integration for showings",
    "Mobile app for on-the-go access",
    "24/7 customer support"
  ];

  const faqs = [
    {
      q: "How are agents verified?",
      a: "Agents undergo a comprehensive 4-step process: license verification, background check, reference validation, and track record analysis. Only ~20% of applicants are approved."
    },
    {
      q: "What's included in the NDA?",
      a: "The NDA protects deal information, property details, investment strategies, and any confidential communications. It's legally binding and enforced."
    },
    {
      q: "Can I cancel my subscription?",
      a: "Yes, cancel anytime. You'll retain access through the end of your billing period with no penalties."
    },
    {
      q: "How are reviews verified?",
      a: "Reviews can only be submitted by investors who completed transactions through the platform. We verify the transaction and NDA status before allowing reviews."
    }
  ];

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 via-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-6">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300">For Real Estate Investors</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Connect with Verified, Investor-Friendly Agents
              </h1>
              <p className="text-xl text-slate-300 mb-8">
                Access a curated network of thoroughly vetted agents who specialize in protecting investor interests. Every connection protected by enterprise-grade security.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  onClick={() => navigate(createPageUrl("Pricing"))}
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white/20 hover:bg-white/10 text-white w-full sm:w-auto"
                  onClick={() => navigate(createPageUrl("Pricing"))}
                >
                  View Pricing
                </Button>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">What You Get</h3>
              <ul className="space-y-4">
                {features.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-200">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Built for Investor Protection
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Every feature designed to prevent deal manipulation and secure your investments.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title}
                className="bg-slate-50 rounded-xl p-8 border border-slate-200 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{benefit.title}</h3>
                <p className="text-slate-600 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-3">{faq.q}</h3>
                <p className="text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to={createPageUrl("FAQ")}>
              <Button variant="outline">
                View All FAQs
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Find Your Verified Agent?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of investors who trust AgentVault for secure connections.
          </p>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 h-14"
            onClick={() => navigate(createPageUrl("Pricing"))}
          >
            See Pricing & Plans
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}