import React, { useEffect, useState } from "react";
import { createPageUrl } from "@/components/utils";
import { Check, Zap, Shield, Building2, ArrowRight, Sparkles, X, CreditCard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentProfile } from "@/components/useCurrentProfile";

export default function Pricing() {
  const { user, profile, loading, refresh } = useCurrentProfile();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const cancelled = searchParams.get("cancelled");
  const auto = searchParams.get("auto");
  const returnTo = searchParams.get("returnTo");

  useEffect(() => {
    if (cancelled) {
      toast("Checkout cancelled", {
        description: "You can subscribe anytime to continue.",
      });
    }
  }, [cancelled]);

  // Check subscription status when page loads
  useEffect(() => {
    const checkSubscription = async () => {
      if (loading || !user || !profile) {
        return;
      }
      
      // Skip redirect for admins - let them view pricing
      const isAdmin = profile?.role === 'admin';
      if (isAdmin) {
        console.log('[Pricing] Admin detected, showing pricing page');
        return;
      }
      
      try {
        console.log('Checking subscription status...');
        
        // Check profile first for subscription status (faster than API call)
        const profileSubStatus = profile?.subscription_status;
        if (profileSubStatus === 'active' || profileSubStatus === 'trialing') {
          console.log('User has active subscription from profile, redirecting...');
          if (profile?.user_role === 'agent') {
            navigate(createPageUrl("Pipeline"), { replace: true });
          } else if (profile?.user_role === 'investor') {
            navigate(createPageUrl("IdentityVerification"), { replace: true });
          } else {
            navigate(createPageUrl("Pipeline"), { replace: true });
          }
          return;
        }
        
        // Only call stripeValidate if profile doesn't show active subscription
        try {
          const response = await base44.functions.invoke('stripeValidate', {});
          
          if (response?.data?.ok) {
            const subscription = response.data.subscription;
            setSubscriptionStatus(subscription?.status || null);
            
            console.log('Subscription status:', subscription?.status);
            
            // If user has active subscription, redirect to appropriate dashboard
            if (subscription?.status === 'active' || subscription?.status === 'trialing') {
              console.log('User has active subscription, redirecting...');
              
              if (profile?.user_role === 'agent') {
                navigate(createPageUrl("Pipeline"), { replace: true });
              } else if (profile?.user_role === 'investor') {
                navigate(createPageUrl("IdentityVerification"), { replace: true });
              } else {
                navigate(createPageUrl("Pipeline"), { replace: true });
              }
            }
          }
        } catch (apiError) {
          console.warn('stripeValidate API call failed, continuing with page:', apiError.message);
          // Don't block the page - just show pricing options
        }
      } catch (error) {
        console.error('Subscription check failed:', error);
      }
    };

    checkSubscription();
  }, [user, profile, loading, navigate]);

  const handleSubscribe = async (plan) => {
    if (!user) {
      navigate(createPageUrl("Login"));
      return;
    }

    setCheckoutLoading(true);
    try {
      console.log(`Starting checkout for plan: ${plan}`);
      
      const response = await base44.functions.invoke('checkoutLite', { plan });
      
      if (response?.data?.ok && response.data.url) {
        console.log('Redirecting to Stripe checkout:', response.data.url);
        window.location.href = response.data.url;
      } else {
        throw new Error(response?.data?.message || response?.data?.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error("Checkout Failed", {
        description: error.message || "There was an error starting the checkout process.",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const features = [
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Fast Deal Execution",
      description: "Move from match to closing faster with streamlined workflows",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Secure Deal Rooms",
      description: "Private communication and document sharing for each deal",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "AI-Powered Tools",
      description: "Contract summaries, risk analysis, and deal insights",
    },
  ];

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: "$29",
      period: "/month",
      description: "Perfect for getting started",
      features: [
        "Access to all deal rooms",
        "Unlimited agent matching",
        "Basic contract generation",
        "Standard support",
      ],
      popular: true,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$79",
      period: "/month",
      description: "For serious investors",
      features: [
        "Everything in Starter",
        "Advanced contract features",
        "Priority support",
        "Deal analytics",
        "Custom deal templates",
      ],
      popular: false,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "$199",
      period: "/month",
      description: "For teams and institutions",
      features: [
        "Everything in Pro",
        "Team collaboration",
        "Dedicated account manager",
        "Custom integrations",
        "White-label options",
      ],
      popular: false,
    },
  ];

  // Don't block on loading - show pricing page immediately

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#E3C567]/10 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-6">
              Choose Your Plan
            </h1>
            <p className="text-xl text-[#808080] max-w-2xl mx-auto mb-8">
              Unlock the full potential of Investor Konnect with a subscription that fits your needs
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-[#0D0D0D] border border-[#1F1F1F] rounded-full">
              <CreditCard className="w-4 h-4 text-[#E3C567] mr-2" />
              <span className="text-sm text-[#808080]">14-day free trial • Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => (
            <div key={index} className="text-center">
              <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-[#E3C567]">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-[#808080]">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="grid lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative bg-[#0D0D0D] border-[#1F1F1F] p-8 ${
                plan.popular ? "ring-2 ring-[#E3C567]" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-[#E3C567] text-black px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-[#808080] mb-4">{plan.description}</p>
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-[#808080] ml-1">{plan.period}</span>
                </div>
              </div>

              <Separator className="bg-[#1F1F1F] mb-6" />

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-[#10B981] mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-[#808080]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={checkoutLoading}
                className={`w-full ${
                  plan.popular
                    ? "bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                    : "bg-[#1F1F1F] hover:bg-[#2F2F2F] text-white"
                } font-semibold rounded-full h-12`}
              >
                {checkoutLoading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-[#808080] mb-4">
            Questions? Contact our support team
          </p>
          <Button
            variant="ghost"
            className="text-[#E3C567] hover:text-[#EDD89F] hover:bg-[#E3C567]/10"
            onClick={() => navigate(createPageUrl("Support"))}
          >
            Get Support
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}