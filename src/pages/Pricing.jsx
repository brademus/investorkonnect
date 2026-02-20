import React, { useEffect, useState } from "react";
import { createPageUrl } from "@/components/utils";
import { Check, Zap, Shield, ArrowRight, Sparkles, CreditCard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { reportError } from "@/components/utils/reportError";

export default function Pricing() {
  const { user, profile, loading, refresh } = useCurrentProfile();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

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
      if (loading) {
        return;
      }
      
      if (!user) {
        setCheckingSubscription(false);
        return;
      }
      
      try {
        setCheckingSubscription(true);
        console.log('Checking subscription status...');
        
        const response = await base44.functions.invoke('stripeValidate', {});
        
        if (response?.data?.ok) {
          const subscription = response.data.subscription;
          setSubscriptionStatus(subscription?.status || null);
          
          console.log('Subscription status:', subscription?.status);
        }
      } catch (error) {
        console.error('Subscription check failed:', error);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user, loading]);

  const handleSubscribe = async () => {
    if (!user) {
      navigate(createPageUrl("Login"));
      return;
    }

    setCheckoutLoading(true);
    try {
      let response;
      let lastError;
      // Retry up to 2 times to handle cold-start 502s
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await base44.functions.invoke('checkoutLite', { plan: 'membership' });
          if (response?.data?.ok && response.data.url) break;
          lastError = new Error(response?.data?.message || response?.data?.error || "Failed to create checkout session");
          response = null;
        } catch (err) {
          lastError = err;
          response = null;
          if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      if (response?.data?.ok && response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw lastError || new Error("Failed to create checkout session");
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

  if (loading || checkingSubscription) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E3C567] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#808080]">Checking subscription status...</p>
        </div>
      </div>
    );
  }

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
              <span className="text-sm text-[#808080]">Cancel anytime</span>
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

        {/* Single Membership Plan */}
        <div className="max-w-lg mx-auto">
          <Card className="relative bg-[#0D0D0D] border-[#1F1F1F] p-8 ring-2 ring-[#E3C567]">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-white mb-2">Investor Konnect Membership</h3>
              <p className="text-[#808080] mb-4">Full access to everything you need</p>
              <div className="flex items-baseline justify-center">
                <span className="text-5xl font-bold text-white">$49</span>
                <span className="text-[#808080] ml-1">/month</span>
              </div>
            </div>

            <Separator className="bg-[#1F1F1F] mb-6" />

            <ul className="space-y-3 mb-8">
              {[
                "Access to all deal rooms",
                "Unlimited agent matching",
                "AI-powered contract tools",
                "Secure document sharing",
                "Deal analytics & insights",
                "Priority support",
              ].map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="w-5 h-5 text-[#10B981] mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-[#808080]">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={handleSubscribe}
              disabled={checkoutLoading}
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold rounded-full h-12"
            >
              {checkoutLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Subscribe Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </Card>
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