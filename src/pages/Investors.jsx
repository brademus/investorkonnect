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
    <div className="min-h-screen bg-[#0F0F0F]">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0F0F0F] via-[#1A1A1A] to-[#E5C37F]/20 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#E5C37F]/20 border border-[#E5C37F]/30 rounded-full px-4 py-2 mb-6">
                <TrendingUp className="w-4 h-4 text-[#E5C37F]" />
                <span className="text-sm text-[#E5C37F]">For Real Estate Investors</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-[#E5C37F]">
                Connect with Verified, Investor-Friendly Agents
              </h1>
              <p className="text-xl text-[#A6A6A6] mb-8">
                Access a curated network of thoroughly vetted agents who specialize in protecting investor interests. Every connection protected by enterprise-grade security.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E5C37F] to-[#C9A961] px-8 py-4 text-base font-semibold text-[#0F0F0F] shadow-lg shadow-[#E5C37F]/30 transition-all hover:from-[#F0D699] hover:to-[#D4AF37] hover:shadow-xl hover:-translate-y-0.5 w-full sm:w-auto"
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
            <div className="bg-[#1A1A1A]/80 backdrop-blur-sm border border-[#333333] rounded-3xl p-8">
              <h3 className="text-2xl font-bold mb-6 text-[#E5C37F]">What You Get</h3>
              <ul className="space-y-4">
                {features.slice(0, 6).map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-[#E5C37F] mt-0.5 flex-shrink-0" />
                    <span className="text-[#A6A6A6]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section className="py-20 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#E5C37F]/20 border border-[#E5C37F]/30 rounded-full px-4 py-2 mb-4">
              <MapPin className="w-4 h-4 text-[#E5C37F]" />
              <span className="text-sm font-semibold text-[#E5C37F]">Get Started</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#E5C37F] mb-4">
              Select Your Investment Market
            </h2>
            <p className="text-xl text-[#A6A6A6] max-w-2xl mx-auto">
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
      <section className="py-20 bg-[#0F0F0F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#E5C37F] mb-4">
              Built for Investor Protection
            </h2>
            <p className="text-xl text-[#A6A6A6] max-w-2xl mx-auto">
              Every feature designed to prevent deal manipulation and secure your investments.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div 
                key={benefit.title}
                className="rounded-3xl border border-[#333333] bg-[#1A1A1A] p-8 shadow-xl hover:shadow-[0_10px_25px_rgba(229,195,127,0.2)] hover:border-[#E5C37F] hover:-translate-y-1 transition-all"
              >
                <div className="w-12 h-12 bg-[#E5C37F]/20 rounded-xl flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-[#E5C37F]" />
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-3">{benefit.title}</h3>
                <p className="text-[#A6A6A6] leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#E5C37F] mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-3xl border border-[#333333] bg-[#1A1A1A] p-6 shadow-xl">
                <h3 className="text-lg font-bold text-[#E5C37F] mb-3">{faq.q}</h3>
                <p className="text-[#A6A6A6] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to={createPageUrl("FAQ")}>
              <button className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#333333] bg-[#1A1A1A] px-6 py-3.5 text-base font-medium text-[#FAFAFA] shadow-sm transition-all hover:border-[#E5C37F] hover:shadow-md hover:-translate-y-0.5">
                View All FAQs
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#E5C37F]">
            Ready to Find Your Verified Agent?
          </h2>
          <p className="text-xl text-[#A6A6A6] mb-8">
            Join thousands of investors who trust Investor Konnect for secure connections.
          </p>
          <button 
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#E5C37F] to-[#C9A961] px-8 py-4 text-lg font-semibold text-[#0F0F0F] shadow-lg shadow-[#E5C37F]/30 transition-all hover:from-[#F0D699] hover:to-[#D4AF37] hover:shadow-xl hover:-translate-y-0.5"
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