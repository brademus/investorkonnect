import React, { useEffect, useState } from "react";
import { createPageUrl } from "@/components/utils";
import { Check, Zap, Shield, ArrowRight, Sparkles, CreditCard, ChevronRight, Users, Minus, Plus, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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

  // Team flow state
  const [showTeamFlow, setShowTeamFlow] = useState(false);
  const [seatCount, setSeatCount] = useState(1);
  const [teamEmails, setTeamEmails] = useState([""]);
  const [teamCheckoutLoading, setTeamCheckoutLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const cancelled = searchParams.get("cancelled");

  const ownerDomain = user?.email?.split('@')[1] || 'company.com';

  useEffect(() => {
    if (cancelled) {
      toast("Checkout cancelled", { description: "You can subscribe anytime to continue." });
    }
  }, [cancelled]);

  useEffect(() => {
    const checkSubscription = async () => {
      if (loading) return;
      if (!user) { setCheckingSubscription(false); return; }
      try {
        setCheckingSubscription(true);
        const response = await base44.functions.invoke('stripeValidate', {});
        if (response?.data?.ok) {
          const liveStatus = response.data.subscription?.status || null;
          const cachedStatus = profile?.subscription_status || null;
          setSubscriptionStatus(liveStatus || cachedStatus);
        }
      } catch (error) {
        console.error('Subscription check failed:', error);
        if (profile?.subscription_status) setSubscriptionStatus(profile.subscription_status);
      } finally {
        setCheckingSubscription(false);
      }
    };
    checkSubscription();
  }, [user, loading]);

  // Adjust email array when seat count changes
  useEffect(() => {
    setTeamEmails(prev => {
      const newArr = [...prev];
      while (newArr.length < seatCount) newArr.push("");
      while (newArr.length > seatCount) newArr.pop();
      return newArr;
    });
  }, [seatCount]);

  const handleSoloSubscribe = async () => {
    if (!user) { navigate(createPageUrl("Login")); return; }
    setCheckoutLoading(true);
    try {
      let response, lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await base44.functions.invoke('checkoutLite', { plan: 'membership' });
          if (response?.data?.ok && response.data.url) break;
          lastError = new Error(response?.data?.message || response?.data?.error || "Failed to create checkout session");
          response = null;
        } catch (err) { lastError = err; response = null; if (attempt < 2) await new Promise(r => setTimeout(r, 1500)); }
      }
      if (response?.data?.ok && response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw lastError || new Error("Failed to create checkout session");
      }
    } catch (error) {
      console.error('Checkout error:', error);
      reportError("Checkout Failed", { cause: error, extra: { user_id: user?.id, profile_id: profile?.id, plan: 'membership' } });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleTeamSubscribe = async () => {
    const trimmed = teamEmails.map(e => e.trim().toLowerCase());
    for (let i = 0; i < trimmed.length; i++) {
      if (!trimmed[i] || !trimmed[i].includes('@')) {
        toast.error(`Please enter a valid email for seat ${i + 1}`);
        return;
      }
      const domain = trimmed[i].split('@')[1];
      if (domain !== ownerDomain) {
        toast.error(`Seat ${i + 1}: Team members must use @${ownerDomain} email addresses`);
        return;
      }
      if (trimmed[i] === user.email.toLowerCase()) {
        toast.error(`Seat ${i + 1}: You cannot add yourself as a team member`);
        return;
      }
    }
    const unique = new Set(trimmed);
    if (unique.size !== trimmed.length) {
      toast.error("Each team member must have a unique email address");
      return;
    }

    setTeamCheckoutLoading(true);
    try {
      let response, lastError;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await base44.functions.invoke('checkoutTeam', { emails: trimmed });
          if (response?.data?.ok && response.data.url) break;
          lastError = new Error(response?.data?.message || response?.data?.error || "Failed to create checkout");
          response = null;
        } catch (err) { lastError = err; response = null; if (attempt < 2) await new Promise(r => setTimeout(r, 1500)); }
      }
      if (response?.data?.ok && response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw lastError || new Error("Failed to create team checkout");
      }
    } catch (error) {
      console.error('Team checkout error:', error);
      let errMsg = error?.message || "Failed to start team checkout";
      if (error?.response?.data?.message) errMsg = error.response.data.message;
      else if (error?.data?.message) errMsg = error.data.message;
      toast.error(errMsg);
      reportError("Team Checkout Failed", { cause: error, extra: { user_id: user?.id, seat_count: seatCount } });
    } finally {
      setTeamCheckoutLoading(false);
    }
  };

  const totalTeamPrice = 49 + (seatCount * 10);

  const features = [
    { icon: <Zap className="w-5 h-5" />, title: "Fast Deal Execution", description: "Move from match to closing faster with streamlined workflows" },
    { icon: <Shield className="w-5 h-5" />, title: "Secure Deal Rooms", description: "Private communication and document sharing for each deal" },
    { icon: <Sparkles className="w-5 h-5" />, title: "AI-Powered Tools", description: "Contract summaries, contract verification, and intelligent agent matching" },
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

  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#E3C567]/10 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-6">Choose Your Plan</h1>
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

        {/* Two Plan Cards — Side by Side */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

          {/* SOLO PLAN */}
          <Card className="relative bg-[#0D0D0D] border-[#1F1F1F] p-8 flex flex-col">
            <div className="mb-6 text-center">
              <div className="w-12 h-12 bg-[#E3C567]/15 rounded-xl flex items-center justify-center mx-auto mb-4">
                <User className="w-6 h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Solo</h3>
              <p className="text-[#808080] mb-4">For individual investors</p>
              <div className="flex items-baseline justify-center">
                <span className="text-5xl font-bold text-white">$49</span>
                <span className="text-[#808080] ml-1">/month</span>
              </div>
            </div>

            <Separator className="bg-[#1F1F1F] mb-6" />

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "Access to all deal rooms",
                "Unlimited agent matching",
                "Contract summaries & verification",
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
              onClick={handleSoloSubscribe}
              disabled={checkoutLoading || isSubscribed}
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold rounded-full h-12"
            >
              {checkoutLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isSubscribed ? (
                "Current Plan"
              ) : (
                <>
                  Subscribe Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </Card>

          {/* TEAM PLAN */}
          <Card className="relative bg-[#0D0D0D] border-[#1F1F1F] p-8 ring-2 ring-[#E3C567] flex flex-col">
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-[#E3C567] text-black text-xs font-bold rounded-full uppercase tracking-wider">
                Best Value
              </span>
            </div>

            <div className="mb-6 text-center">
              <div className="w-12 h-12 bg-[#E3C567]/15 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-[#E3C567]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Team</h3>
              <p className="text-[#808080] mb-4">Share your pipeline with your team</p>
              <div className="flex items-baseline justify-center">
                <span className="text-5xl font-bold text-white">$49</span>
                <span className="text-[#808080] ml-1">/mo</span>
                <span className="text-[#808080] ml-2">+</span>
                <span className="text-2xl font-bold text-[#E3C567] ml-2">$10</span>
                <span className="text-[#808080] ml-1">/seat</span>
              </div>
            </div>

            <Separator className="bg-[#1F1F1F] mb-6" />

            <ul className="space-y-3 mb-6 flex-1">
              {[
                "Everything in Solo, plus:",
                "Shared deal pipeline for your team",
                "Admin & viewer access controls",
                "Team members use your company email",
                "Each member completes their own verification",
              ].map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="w-5 h-5 text-[#10B981] mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-[#808080]">{feature}</span>
                </li>
              ))}
            </ul>

            {!showTeamFlow ? (
              <Button
                onClick={() => isSubscribed ? navigate(createPageUrl("TeamAccount")) : setShowTeamFlow(true)}
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold rounded-full h-12"
              >
                {isSubscribed ? (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Manage Team
                  </>
                ) : (
                  <>
                    Open a Team Account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              /* TEAM SETUP FLOW — inline inside the card */
              <div className="space-y-5 border-t border-[#1F1F1F] pt-5">
                {/* Seat counter */}
                <div>
                  <label className="text-sm font-medium text-[#FAFAFA] mb-2 block">How many team members?</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSeatCount(Math.max(1, seatCount - 1))}
                      className="w-10 h-10 rounded-xl bg-[#141414] border border-[#333] flex items-center justify-center text-[#FAFAFA] hover:border-[#E3C567] transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-16 h-10 rounded-xl bg-[#141414] border border-[#333] flex items-center justify-center">
                      <span className="text-xl font-bold text-[#E3C567]">{seatCount}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSeatCount(Math.min(10, seatCount + 1))}
                      className="w-10 h-10 rounded-xl bg-[#141414] border border-[#333] flex items-center justify-center text-[#FAFAFA] hover:border-[#E3C567] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-[#808080] ml-2">× $10/mo each</span>
                  </div>
                </div>

                {/* Email inputs */}
                <div>
                  <label className="text-sm font-medium text-[#FAFAFA] mb-2 block">
                    Team member emails
                    <span className="text-xs text-[#808080] font-normal ml-2">Must be @{ownerDomain}</span>
                  </label>
                  <div className="space-y-2">
                    {teamEmails.map((email, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-[#808080] font-semibold">{idx + 1}</span>
                        </div>
                        <Input
                          type="email"
                          placeholder={`teammate${idx + 1}@${ownerDomain}`}
                          value={email}
                          onChange={(e) => {
                            const updated = [...teamEmails];
                            updated[idx] = e.target.value;
                            setTeamEmails(updated);
                          }}
                          className="bg-[#141414] border-[#333] text-[#FAFAFA] flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price summary */}
                <div className="rounded-xl bg-[#141414] border border-[#1F1F1F] p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#808080]">Membership</span>
                    <span className="text-[#FAFAFA]">$49/mo</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-[#808080]">{seatCount} team seat{seatCount !== 1 ? 's' : ''}</span>
                    <span className="text-[#FAFAFA]">${seatCount * 10}/mo</span>
                  </div>
                  <Separator className="bg-[#1F1F1F] my-2" />
                  <div className="flex justify-between">
                    <span className="text-[#FAFAFA] font-semibold">Total</span>
                    <span className="text-[#E3C567] font-bold text-lg">${totalTeamPrice}/mo</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setShowTeamFlow(false); setSeatCount(1); setTeamEmails([""]); }}
                    className="border-[#333] text-[#808080] hover:bg-[#141414]"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleTeamSubscribe}
                    disabled={teamCheckoutLoading}
                    className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold rounded-full h-12"
                  >
                    {teamCheckoutLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Subscribe with Team — ${totalTeamPrice}/mo
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* If already subscribed, show link to team management */}
        {isSubscribed && (
          <div className="text-center mt-8">
            <Button
              onClick={() => navigate(createPageUrl("TeamAccount"))}
              variant="outline"
              className="border-[#E3C567]/30 text-[#E3C567] hover:bg-[#E3C567]/10"
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Your Team
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-16">
          <p className="text-[#808080] mb-4">Questions? Contact our support team</p>
          <Button variant="ghost" className="text-[#E3C567] hover:text-[#EDD89F] hover:bg-[#E3C567]/10">
            Get Support
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}