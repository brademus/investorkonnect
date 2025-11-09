
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, ArrowRight, Shield, Zap, Crown, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PUBLIC_APP_URL = "https://agent-vault-da3d088b.base44.app";

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const navigate = useNavigate();
  
  // Use unified profile hook
  const { 
    loading, 
    role, 
    onboarded, 
    hasNDA, 
    kycVerified,
    isInvestorReady 
  } = useCurrentProfile();

  useEffect(() => {
    document.title = "Pricing - AgentVault";
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = "Choose the AgentVault plan that fits your investment needs. Starter, Pro, and Enterprise plans with 14-day free trial.";
  }, []);

  // Determine what's blocking investor (if anything)
  const getBlockingStep = () => {
    if (role !== 'investor') return null;
    
    if (!onboarded) return 'onboarding';
    if (!kycVerified) return 'verification';
    if (!hasNDA) return 'nda';
    
    return null; // All clear!
  };

  const blockingStep = getBlockingStep();

  const handleGetStarted = (plan) => {
    // Enterprise always goes to contact
    if (plan === 'enterprise') {
      navigate(createPageUrl("Contact"));
      return;
    }

    // Check if authenticated
    const isAuthenticated = !!role;
    
    // Not authenticated - redirect to login
    if (!isAuthenticated) {
      toast.info("Please sign in to continue");
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }

    // For investors, check if fully ready
    if (role === 'investor') {
      if (!isInvestorReady) {
        // Route to the appropriate missing step
        if (!onboarded) {
          toast.error("Please complete your investor profile first", {
            duration: 5000,
            description: "We need to know your investment goals"
          });
          navigate(createPageUrl("InvestorOnboarding"));
        } else if (!kycVerified) {
          toast.error("Please verify your identity first", {
            duration: 5000,
            description: "Identity verification required for subscriptions"
          });
          navigate(createPageUrl("Verify"));
        } else if (!hasNDA) {
          toast.error("Please accept the NDA first", {
            duration: 5000,
            description: "NDA acceptance required for subscriptions"
          });
          navigate(createPageUrl("NDA"));
        }
        return;
      }

      // Investor is ready - proceed to checkout
      window.open(`${PUBLIC_APP_URL}/functions/checkoutLite?plan=${plan}`, '_self');
      return;
    }

    // For other roles (agents, etc.) - allow checkout
    window.open(`${PUBLIC_APP_URL}/functions/checkoutLite?plan=${plan}`, '_self');
  };

  // Get banner message based on what's blocking
  const getBannerMessage = () => {
    if (!blockingStep) return null;
    
    switch (blockingStep) {
      case 'onboarding':
        return {
          icon: Lock,
          text: "Complete your investor profile to unlock subscriptions",
          buttonText: "Complete Profile",
          onClick: () => navigate(createPageUrl("InvestorOnboarding"))
        };
      case 'verification':
        return {
          icon: Shield,
          text: "Verify your identity to unlock subscriptions",
          buttonText: "Verify Identity",
          onClick: () => navigate(createPageUrl("Verify"))
        };
      case 'nda':
        return {
          icon: Lock,
          text: "Accept the NDA to unlock subscriptions",
          buttonText: "Sign NDA",
          onClick: () => navigate(createPageUrl("NDA"))
        };
      default:
        return null;
    }
  };

  const bannerConfig = getBannerMessage();

  const tiers = [
    {
      name: "Starter",
      icon: Zap,
      price: { monthly: 19, annual: 15 },
      description: "Perfect for individual investors starting out",
      features: [
        "Browse 500+ verified agents",
        "View verified reviews",
        "Basic search filters",
        "Secure messaging",
        "Deal room access (1 active)",
        "Email support"
      ],
      notIncluded: [
        "Advanced analytics",
        "Priority support",
        "Custom reports"
      ],
      cta: "Start Free Trial",
      color: "blue",
      planId: "starter"
    },
    {
      name: "Pro",
      icon: Shield,
      price: { monthly: 49, annual: 39 },
      description: "For serious investors managing multiple deals",
      features: [
        "Everything in Starter, plus:",
        "Advanced search & filters",
        "Deal rooms (unlimited)",
        "Transaction tracking",
        "Document sharing & e-signatures",
        "Agent performance analytics",
        "Priority email support",
        "Mobile app access"
      ],
      notIncluded: [
        "Dedicated account manager",
        "Custom integrations"
      ],
      cta: "Start Free Trial",
      popular: true,
      color: "emerald",
      planId: "pro"
    },
    {
      name: "Enterprise",
      icon: Crown,
      price: { monthly: 99, annual: 79 },
      description: "For investment firms and high-volume investors",
      features: [
        "Everything in Pro, plus:",
        "Team collaboration tools",
        "White-label deal rooms",
        "Custom API access",
        "Dedicated account manager",
        "SLA guarantees",
        "Custom contracts & NDAs",
        "Quarterly business reviews",
        "Phone & Slack support"
      ],
      notIncluded: [],
      cta: "Contact Sales",
      color: "purple",
      planId: "enterprise"
    }
  ];

  const comparisonFeatures = [
    { category: "Core Features", features: [
      { name: "Verified agent profiles", starter: true, pro: true, enterprise: true },
      { name: "Platform-verified reviews", starter: true, pro: true, enterprise: true },
      { name: "NDA-protected deal rooms", starter: "1 active", pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Secure messaging", starter: true, pro: true, enterprise: true },
      { name: "Document sharing", starter: false, pro: true, enterprise: true }
    ]},
    { category: "Search & Discovery", features: [
      { name: "Basic search filters", starter: true, pro: true, enterprise: true },
      { name: "Advanced filters & saved searches", starter: false, pro: true, enterprise: true },
      { name: "Agent performance analytics", starter: false, pro: true, enterprise: true },
      { name: "Custom reports", starter: false, pro: false, enterprise: true }
    ]},
    { category: "Support", features: [
      { name: "Email support", starter: true, pro: true, enterprise: true },
      { name: "Priority support", starter: false, pro: true, enterprise: true },
      { name: "Dedicated account manager", starter: false, pro: false, enterprise: true },
      { name: "Phone & Slack support", starter: false, pro: false, enterprise: true }
    ]}
  ];

  const faqs = [
    {
      q: "Is there a free trial?",
      a: "Yes! All paid plans include a 14-day free trial. No credit card required to start."
    },
    {
      q: "Can I cancel anytime?",
      a: "Absolutely. Cancel anytime with no penalties. You'll retain access through the end of your billing period."
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept all major credit cards, debit cards, and ACH bank transfers. All transactions are processed securely through Stripe."
    },
    {
      q: "Do you offer refunds?",
      a: "We offer a 30-day money-back guarantee. If you're not satisfied, contact us for a full refund within 30 days of purchase."
    },
    {
      q: "Is agent membership free?",
      a: "Yes! Agents never pay to join AgentVault. We charge investors, not agents, so agents can focus on serving clients."
    },
    {
      q: "Can I upgrade or downgrade my plan?",
      a: "Yes, you can change plans anytime. Upgrades take effect immediately; downgrades at the end of your billing cycle."
    }
  ];

  return (
    <div>
      {/* Blocking Step Banner (only for investors who aren't ready) */}
      {!loading && role === 'investor' && !isInvestorReady && bannerConfig && (
        <div className="bg-orange-600 text-white py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <bannerConfig.icon className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">
                  {bannerConfig.text}
                </p>
              </div>
              <Button 
                size="sm" 
                className="bg-white text-orange-600 hover:bg-orange-50"
                onClick={bannerConfig.onClick}
              >
                {bannerConfig.buttonText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Simple, Transparent Pricing</h1>
          <p className="text-xl text-slate-300 mb-8">
            Choose the plan that fits your investment needs. All plans include 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-white text-slate-900"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === "annual"
                  ? "bg-white text-slate-900"
                  : "text-white hover:bg-white/10"
              }`}
            >
              Annual
              <span className="ml-2 text-xs bg-emerald-500 text-white px-2 py-0.5 rounded">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-white rounded-2xl shadow-xl border-2 ${
                  tier.popular ? "border-emerald-500 relative" : "border-slate-200"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-500 text-white text-sm font-medium px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="p-8">
                  <div className={`w-12 h-12 bg-${tier.color}-100 rounded-lg flex items-center justify-center mb-4`}>
                    <tier.icon className={`w-6 h-6 text-${tier.color}-600`} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                  <p className="text-slate-600 mb-6">{tier.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900">
                      ${tier.price[billingCycle]}
                    </span>
                    <span className="text-slate-600">/{billingCycle === "monthly" ? "month" : "month, billed annually"}</span>
                  </div>
                  
                  {/* CTA Button - Conditional on investor readiness */}
                  {!loading && role === 'investor' && !isInvestorReady && tier.planId !== 'enterprise' ? (
                    <div className="space-y-3">
                      <Button
                        className="w-full bg-slate-300 text-slate-700 cursor-not-allowed"
                        disabled
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        {blockingStep === 'onboarding' ? 'Complete Profile Required' :
                         blockingStep === 'verification' ? 'Verification Required' :
                         blockingStep === 'nda' ? 'NDA Required' :
                         'Complete Setup Required'}
                      </Button>
                      <p className="text-xs text-center text-slate-600">
                        <button 
                          onClick={bannerConfig?.onClick}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {blockingStep === 'onboarding' ? 'Complete your profile' :
                           blockingStep === 'verification' ? 'Verify your identity' :
                           blockingStep === 'nda' ? 'Sign the NDA' :
                           'Complete setup'}
                        </button> to subscribe
                      </p>
                    </div>
                  ) : (
                    <Button
                      className={`w-full ${
                        tier.popular
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-slate-900 hover:bg-slate-800"
                      }`}
                      onClick={() => handleGetStarted(tier.planId)}
                    >
                      {tier.cta}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
                <div className="border-t border-slate-200 p-8">
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                    {tier.notIncluded.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 opacity-40">
                        <X className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Info Box for unauthenticated users */}
          {!loading && !role && (
            <div className="mt-12 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-blue-900 mb-2">Sign In to Subscribe</h3>
                  <p className="text-blue-800 mb-4">
                    Create a free account to start your 14-day trial. No credit card required.
                  </p>
                  <Button 
                    onClick={() => base44.auth.redirectToLogin(window.location.pathname)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Sign In / Create Account
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
            Detailed Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-4 px-4 font-semibold text-slate-900">Features</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-900">Starter</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-900">Pro</th>
                  <th className="text-center py-4 px-4 font-semibold text-slate-900">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-slate-50">
                      <td colSpan="4" className="py-3 px-4 font-semibold text-slate-900">
                        {category.category}
                      </td>
                    </tr>
                    {category.features.map((feature) => (
                      <tr key={feature.name} className="border-b border-slate-100">
                        <td className="py-4 px-4 text-slate-700">{feature.name}</td>
                        <td className="py-4 px-4 text-center">
                          {typeof feature.starter === "boolean" ? (
                            feature.starter ? (
                              <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-slate-700">{feature.starter}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {typeof feature.pro === "boolean" ? (
                            feature.pro ? (
                              <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-slate-700">{feature.pro}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {typeof feature.enterprise === "boolean" ? (
                            feature.enterprise ? (
                              <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-slate-700">{feature.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-12 text-center">
            Pricing FAQs
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-3">{faq.q}</h3>
                <p className="text-slate-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Start Your Free Trial Today
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            No credit card required. Cancel anytime. 30-day money-back guarantee.
          </p>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 h-14"
            onClick={() => handleGetStarted('starter')}
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}
