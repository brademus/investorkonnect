import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, ArrowRight, Shield, Zap, Crown, Lock, AlertCircle, Check } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { toast } from "sonner";
import { devLog } from "@/components/devLogger";

const PUBLIC_APP_URL = "https://agent-vault-da3d088b.base44.app";

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const navigate = useNavigate();
  
  const { 
    loading, 
    user,
    profile,
    role, 
    onboarded, 
    hasNDA, 
    kycStatus,
    kycVerified,
    isInvestorReady,
    subscriptionPlan,
    subscriptionStatus,
    isPaidSubscriber
  } = useCurrentProfile();

  useEffect(() => {
    document.title = "Pricing - Investor Konnect";
  }, []);

  const getBlockingStep = () => {
    if (role === 'investor' && !onboarded) return 'onboarding';
    if (role === 'agent' && !onboarded) return 'agent-onboarding';
    return null;
  };

  const blockingStep = getBlockingStep();

  const getPlanName = (plan) => {
    const names = { 'starter': 'Starter', 'pro': 'Pro', 'enterprise': 'Enterprise', 'none': 'Free' };
    return names[plan] || plan;
  };

  const handleGetStarted = async (plan) => {
    console.log('[Pricing] handleGetStarted called with plan:', plan);
    
    if (loading) {
      toast.info("Loading your account...");
      return;
    }

    if (checkoutLoading) {
      return; // Prevent double-clicks
    }
    
    if (plan === 'enterprise') {
      navigate(createPageUrl("Contact"));
      return;
    }

    if (!user) {
      toast.info("Please sign in to continue");
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }

    // Check if user has completed onboarding (for both investor and agent)
    if ((role === 'investor' || role === 'agent') && !onboarded) {
      const onboardingPage = role === 'agent' ? 'AgentOnboarding' : 'InvestorOnboarding';
      toast.error(`Please complete your ${role} profile first`);
      navigate(createPageUrl(onboardingPage));
      return;
    }

    setCheckoutLoading(true);
    const toastId = 'checkout-' + Date.now();
    toast.loading("Opening checkout...", { id: toastId });

    try {
      console.log('[Pricing] Calling checkoutLite with plan:', plan);
      const response = await base44.functions.invoke('checkoutLite', { plan });

      // Validate response
      if (!response || !response.data) {
        toast.dismiss(toastId);
        toast.error("No response from server. Please try again.");
        setCheckoutLoading(false);
        return;
      }

      if (!response.data.ok) {
        toast.dismiss(toastId);
        toast.error(response.data?.message || "Failed to create checkout session");
        setCheckoutLoading(false);
        return;
      }

      // Validate URL exists
      if (!response.data.url) {
        toast.dismiss(toastId);
        toast.error("Checkout URL not provided. Please contact support.");
        console.error('[Pricing] No checkout URL in response:', response.data);
        setCheckoutLoading(false);
        return;
      }

      // Show redirecting message
      toast.dismiss(toastId);
      toast.loading("Redirecting to Stripe...", { id: toastId + '-redirect' });

      // Add small delay to ensure toast is visible
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to Stripe
      window.location.href = response.data.url;

      // Fallback: If redirect doesn't happen in 3 seconds, show error
      setTimeout(() => {
        toast.dismiss(toastId + '-redirect');
        toast.error("Redirect failed. Please try again or contact support.");
        setCheckoutLoading(false);
      }, 3000);

    } catch (error) {
      toast.dismiss(toastId);
      console.error('[Pricing] Checkout error:', error);
      toast.error("Failed to start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  };

  const getBannerMessage = () => {
    if (!blockingStep) return null;
    
    switch (blockingStep) {
      case 'onboarding':
        return { icon: Lock, text: "Complete your investor profile to unlock subscriptions", buttonText: "Complete Profile", onClick: () => navigate(createPageUrl("InvestorOnboarding")) };
      case 'agent-onboarding':
        return { icon: Lock, text: "Complete your agent profile to unlock subscriptions", buttonText: "Complete Profile", onClick: () => navigate(createPageUrl("AgentOnboarding")) };
      default:
        return null;
    }
  };

  const bannerConfig = getBannerMessage();

  const tiers = [
    {
      name: "STARTER",
      slug: "starter",
      icon: Zap,
      price: { monthly: 19, annual: 15 },
      description: "Perfect for individual investors starting out",
      features: ["1 active deal room", "Connect with up to 3 agents", "Basic messaging", "Email support"],
      notIncluded: ["Advanced analytics", "Priority support", "Custom reports"],
      cta: "Start Free Trial",
      planId: "starter"
    },
    {
      name: "PRO",
      slug: "pro",
      icon: Shield,
      price: { monthly: 49, annual: 39 },
      description: "For serious investors managing multiple deals",
      features: ["Unlimited deal rooms", "Connect with unlimited agents", "Priority messaging", "Contract generation", "Priority support"],
      notIncluded: ["Dedicated account manager", "Custom integrations"],
      cta: "Start Free Trial",
      popular: true,
      planId: "pro"
    },
    {
      name: "ENTERPRISE",
      slug: "enterprise",
      icon: Crown,
      price: { monthly: 99, annual: 79 },
      description: "For investment firms and high-volume investors",
      features: ["Everything in Pro", "Team collaboration", "Advanced analytics", "Dedicated account manager", "Custom integrations"],
      notIncluded: [],
      cta: "Contact Sales",
      planId: "enterprise"
    }
  ];

  const faqs = [
    { q: "Is there a free trial?", a: "Yes! All paid plans include a 14-day free trial. No credit card required to start." },
    { q: "Can I cancel anytime?", a: "Absolutely. Cancel anytime with no penalties. You'll retain access through the end of your billing period." },
    { q: "What payment methods do you accept?", a: "We accept all major credit cards, debit cards, and ACH bank transfers. All transactions are processed securely through Stripe." },
    { q: "Do you offer refunds?", a: "We offer a 30-day money-back guarantee. If you're not satisfied, contact us for a full refund within 30 days of purchase." },
    { q: "Is agent membership free?", a: "Yes! Agents never pay to join Investor Konnect. We charge investors, not agents." },
    { q: "Can I upgrade or downgrade my plan?", a: "Yes, you can change plans anytime. Upgrades take effect immediately; downgrades at the end of your billing cycle." }
  ];

  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}>
      {/* Subscription Status Banner */}
      {!loading && isPaidSubscriber && (
        <div className="bg-[#E3C567] text-black py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm font-medium flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              You are on the <span className="font-bold">{getPlanName(subscriptionPlan)}</span> plan
              {subscriptionStatus === 'trialing' && ' (Free trial active)'}
            </p>
          </div>
        </div>
      )}

      {/* Blocking Step Banner */}
      {!loading && (role === 'investor' || role === 'agent') && !onboarded && !isPaidSubscriber && bannerConfig && (
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <bannerConfig.icon className="w-5 h-5" />
              <p className="text-sm font-medium">{bannerConfig.text}</p>
            </div>
            <Button size="sm" className="bg-white text-orange-600 hover:bg-orange-50" onClick={bannerConfig.onClick}>
              {bannerConfig.buttonText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-[48px] font-bold text-[#E3C567] mb-4">Simple, Transparent Pricing</h1>
          <p className="text-[20px] text-[#808080] mb-8">
            Choose the plan that fits your investment needs. All plans include 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div 
            className="inline-flex items-center rounded-full p-1 border border-[#1F1F1F]"
            style={{ backgroundColor: '#0D0D0D', width: '280px', height: '48px' }}
          >
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`flex-1 h-full rounded-full text-sm font-medium transition-all duration-300 ${
                billingCycle === "monthly"
                  ? "bg-[#E3C567] text-black shadow-md"
                  : "text-[#808080] hover:text-[#E3C567]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`flex-1 h-full rounded-full text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                billingCycle === "annual"
                  ? "bg-[#E3C567] text-black shadow-md"
                  : "text-[#808080] hover:text-[#E3C567]"
              }`}
            >
              Annual
              <span className="text-xs bg-[#E3C567] text-black px-2 py-0.5 rounded-full">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {tiers.map((tier) => {
              const isCurrentPlan = subscriptionPlan === tier.slug && isPaidSubscriber;
              const isPro = tier.popular;
              
              return (
                <div
                  key={tier.name}
                  className={`bg-[#0D0D0D] rounded-3xl relative transition-all duration-250 ${
                    isPro ? 'scale-105 z-10' : ''
                  }`}
                  style={{
                    border: isPro ? '2px solid #E3C567' : '1px solid #1F1F1F',
                    padding: '40px 32px',
                    boxShadow: isPro ? '0 4px 16px rgba(227,197,103,0.3)' : '0 2px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  {/* Most Popular Badge */}
                  {isPro && !isCurrentPlan && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-[#E3C567] text-black text-sm font-medium px-4 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  {/* Current Plan Badge */}
                  {isCurrentPlan && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-[#E3C567] text-black text-sm font-medium px-4 py-1 rounded-full flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Current Plan
                      </span>
                    </div>
                  )}

                  {/* Plan Name */}
                  <p className="text-[16px] uppercase text-[#808080] tracking-wider mb-4">{tier.name}</p>
                  
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-[48px] font-bold text-[#E3C567]">${tier.price[billingCycle]}</span>
                    <span className="text-[16px] text-[#808080]">/month</span>
                  </div>
                  
                  {/* Description */}
                  <p className="text-[14px] text-[#808080] mb-6">{tier.description}</p>
                  
                  {/* Divider */}
                  <div className="h-px bg-[#1F1F1F] my-6"></div>
                  
                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-[#E3C567] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-black" />
                        </div>
                        <span className="text-[14px] text-[#FAFAFA]">{feature}</span>
                      </li>
                    ))}
                    {tier.notIncluded.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 opacity-40">
                        <div className="w-5 h-5 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X className="w-3 h-3 text-[#808080]" />
                        </div>
                        <span className="text-[14px] text-[#808080]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {/* CTA Button */}
                  {isCurrentPlan ? (
                    <button
                      className="w-full h-12 rounded-xl font-bold text-[16px] bg-[#1F1F1F] text-[#808080] cursor-not-allowed flex items-center justify-center gap-2"
                      disabled
                    >
                      <Check className="w-4 h-4" />
                      Your Current Plan
                    </button>
                  ) : !loading && (role === 'investor' || role === 'agent') && !onboarded && tier.planId !== 'enterprise' ? (
                    <button
                      className="w-full h-12 rounded-xl font-bold text-[16px] bg-[#1F1F1F] text-[#808080] cursor-not-allowed flex items-center justify-center gap-2"
                      disabled
                    >
                      <Lock className="w-4 h-4" />
                      Complete Setup Required
                    </button>
                  ) : isPro ? (
                    <button
                      onClick={() => handleGetStarted(tier.planId)}
                      className="w-full h-12 rounded-full font-bold text-[16px] bg-[#E3C567] text-black hover:bg-[#EDD89F] transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                      style={{ boxShadow: '0 4px 12px rgba(227,197,103,0.4)' }}
                      disabled={loading || checkoutLoading}
                    >
                      {(loading || checkoutLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : tier.cta}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleGetStarted(tier.planId)}
                      className="w-full h-12 rounded-xl font-bold text-[16px] border-2 border-[#1F1F1F] text-[#FAFAFA] bg-transparent hover:bg-[#0D0D0D] hover:border-[#E3C567] transition-all duration-200"
                      disabled={loading || checkoutLoading}
                    >
                      {(loading || checkoutLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : tier.cta}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sign In Box for unauthenticated */}
          {!loading && !user && (
            <div className="mt-12 bg-[#1A1A1A] border-2 border-[#E5C37F]/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-[#E5C37F] flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-bold text-[#E5C37F] mb-2">Sign In to Subscribe</h3>
                  <p className="text-[#A6A6A6] mb-4">Create a free account to start your 14-day trial. No credit card required.</p>
                  <Button onClick={() => base44.auth.redirectToLogin(window.location.pathname)} className="bg-gradient-to-r from-[#E5C37F] to-[#C9A961] hover:from-[#F0D699] hover:to-[#D4AF37] text-[#0F0F0F]">
                    Sign In / Create Account
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[36px] font-bold text-[#E5C37F] mb-12 text-center">Pricing FAQs</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#333333]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <h3 className="text-[18px] font-bold text-[#E5C37F] mb-3">{faq.q}</h3>
                <p className="text-[#A6A6A6] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0F0F0F] border-t border-[#333333]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-[36px] font-bold mb-6 text-[#E5C37F]">Start Your Free Trial Today</h2>
          <p className="text-xl text-[#A6A6A6] mb-8">No credit card required. Cancel anytime. 30-day money-back guarantee.</p>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-[#E5C37F] to-[#C9A961] hover:from-[#F0D699] hover:to-[#D4AF37] text-[#0F0F0F] text-lg px-8 h-14 rounded-full shadow-lg"
            onClick={() => handleGetStarted('starter')}
            disabled={loading || checkoutLoading}
          >
            {(loading || checkoutLoading) ? <LoadingAnimation className="w-5 h-5 mr-2" /> : <>Get Started Free <ArrowRight className="w-5 h-5 ml-2" /></>}
          </Button>
        </div>
      </section>
    </div>
  );
}