import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import MapUSA from "@/components/MapUSA";
import LocationPopup from "@/components/LocationPopup";
import { 
  Shield, Star, Lock, FileText, Users, 
  TrendingUp, CheckCircle, ArrowRight, Zap, MapPin
} from "lucide-react";

/**
 * INVESTORS MARKETING PAGE
 * 
 * Public marketing page with interactive state selection
 * Click state → location picker → redirect to role selection
 */
export default function Investors() {
  const navigate = useNavigate();
  const [popup, setPopup] = useState(null);

  const handleStateClick = (stateCode, stateName) => {
    setPopup({ stateCode, stateName });
  };

  const handleLocationContinue = ({ state, stateName, county, city }) => {
    const params = new URLSearchParams();
    params.set('state', state);
    params.set('stateName', stateName);
    if (county) params.set('county', county);
    if (city) params.set('city', city);

    // Redirect to role selection with location context
    navigate(`${createPageUrl("RoleSelection")}?${params.toString()}`);
  };

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
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#D3A029]/80 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#D3A029]/10 border border-[#D3A029]/20 rounded-full px-4 py-2 mb-6">
                <TrendingUp className="w-4 h-4 text-[#FDE68A]" />
                <span className="text-sm text-[#FDE68A]">For Real Estate Investors</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Connect with Verified, Investor-Friendly Agents
              </h1>
              <p className="text-xl text-[#E5E7EB] mb-8">
                Access a curated network of thoroughly vetted agents who specialize in protecting investor interests. Every connection protected by enterprise-grade security.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5 w-full sm:w-auto"
                  onClick={() => navigate(createPageUrl("Pricing"))}
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/20 bg-transparent px-6 py-3.5 text-base font-medium text-white shadow-sm transition-all hover:bg-white/10 hover:-translate-y-0.5 w-full sm:w-auto"
                  onClick={() => navigate(createPageUrl("Pricing"))}
                >
                  View Pricing
                </button>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
              <h3 className="text-2xl font-bold mb-6">What You Get</h3>
              <ul className="space-y-4">
                {features.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#D3A029] mt-0.5 flex-shrink-0" />
                    <span className="text-[#E5E7EB]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section className="py-20 bg-gradient-to-br from-[#FAF7F2] to-[#FEF3C7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#FEF3C7] rounded-full px-4 py-2 mb-4">
              <MapPin className="w-4 h-4 text-[#D3A029]" />
              <span className="text-sm font-semibold text-[#92400E]">Get Started</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4">
              Select Your Investment Market
            </h2>
            <p className="text-xl text-[#6B7280] max-w-2xl mx-auto">
              Click on a state to begin your journey with verified agents in your target market
            </p>
          </div>

          <MapUSA onStateClick={handleStateClick} />
        </div>
      </section>

      {/* Location Popup */}
      {popup && (
        <LocationPopup
          stateCode={popup.stateCode}
          stateName={popup.stateName}
          onClose={() => setPopup(null)}
          onContinue={handleLocationContinue}
        />
      )}

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-4">
              Built for Investor Protection
            </h2>
            <p className="text-xl text-[#6B7280] max-w-2xl mx-auto">
              Every feature designed to prevent deal manipulation and secure your investments.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title}
                className="rounded-3xl border border-[#E5E7EB] bg-[#F9FAFB] p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
              >
                <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-[#D3A029]" />
                </div>
                <h3 className="text-xl font-bold text-[#111827] mb-3">{benefit.title}</h3>
                <p className="text-[#6B7280] leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-[#FAF7F2]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#111827] mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-3xl border border-[#E5E7EB] bg-white p-6 shadow-xl">
                <h3 className="text-lg font-bold text-[#111827] mb-3">{faq.q}</h3>
                <p className="text-[#6B7280] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to={createPageUrl("FAQ")}>
              <button className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#E5E7EB] bg-white px-6 py-3.5 text-base font-medium text-[#111827] shadow-sm transition-all hover:border-[#D3A029] hover:shadow-md hover:-translate-y-0.5">
                View All FAQs
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#D3A029]/80 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Find Your Verified Agent?
          </h2>
          <p className="text-xl text-[#E5E7EB] mb-8">
            Join thousands of investors who trust Investor Konnect for secure connections.
          </p>
          <button 
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D3A029] px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-[#D3A029]/30 transition-all hover:bg-[#B98413] hover:shadow-xl hover:-translate-y-0.5"
            onClick={() => navigate(createPageUrl("Pricing"))}
          >
            See Pricing & Plans
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}