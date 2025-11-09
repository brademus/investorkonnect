import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";

/**
 * BILLING SUCCESS PAGE
 * 
 * After successful Stripe checkout, user lands here.
 * We sync their subscription from Stripe to our database.
 */
export default function BillingSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refresh, subscriptionPlan, subscriptionStatus } = useCurrentProfile();
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState(null);
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    document.title = "Subscription Active! - AgentVault";
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID found. Your subscription may still be active.");
      setSyncing(false);
      return;
    }

    const syncSubscription = async () => {
      try {
        console.log('[BillingSuccess] 🔄 Syncing subscription from Stripe...');
        
        // Call backend function to sync subscription data
        const response = await base44.functions.invoke('syncSubscription', {
          session_id: sessionId
        });

        console.log('[BillingSuccess] 📦 Sync response:', response.data);

        if (response.data?.ok) {
          console.log('[BillingSuccess] ✅ Subscription synced successfully');
          
          // Force profile refresh to load new subscription data
          await refresh();
          
          // Small delay to ensure state propagates
          await new Promise(resolve => setTimeout(resolve, 500));
          
          setSyncing(false);
        } else {
          console.error('[BillingSuccess] ❌ Sync failed:', response.data);
          setError(response.data?.message || "Failed to sync subscription");
          setSyncing(false);
        }
      } catch (err) {
        console.error('[BillingSuccess] ❌ Error syncing:', err);
        setError("Could not sync subscription. Please refresh the page.");
        setSyncing(false);
        
        // Still try to refresh profile in case webhook already updated it
        try {
          await refresh();
        } catch (refreshErr) {
          console.error('[BillingSuccess] Failed to refresh profile:', refreshErr);
        }
      }
    };

    // Wait a moment for user/profile to load, then sync
    const timer = setTimeout(() => {
      if (user && profile) {
        syncSubscription();
      } else {
        // Still loading, wait longer
        setSyncing(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [sessionId, user, profile, refresh]);

  const getPlanName = (plan) => {
    const names = {
      'starter': 'Starter',
      'pro': 'Pro',
      'enterprise': 'Enterprise'
    };
    return names[plan] || plan;
  };

  if (syncing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <Loader2 className="w-16 h-16 text-emerald-600 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Activating Your Subscription...
          </h2>
          <p className="text-slate-600">
            Please wait while we set up your account
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-orange-200 p-8 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Payment Successful!
          </h2>
          <p className="text-slate-600 mb-4">
            Your payment was processed, but we encountered an issue syncing your subscription.
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-800">{error}</p>
          </div>
          <Button
            onClick={() => {
              refresh();
              navigate(createPageUrl("Dashboard"));
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            Continue to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-emerald-200 p-8 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          🎉 Welcome to {getPlanName(subscriptionPlan)}!
        </h1>
        
        <p className="text-lg text-slate-600 mb-6">
          Your subscription is now active
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-700 font-medium">Plan:</span>
            <span className="text-emerald-800 font-bold">{getPlanName(subscriptionPlan)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700 font-medium">Status:</span>
            <span className="text-emerald-800 font-bold capitalize">{subscriptionStatus}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          
          <Button
            onClick={() => navigate(createPageUrl("Pricing"))}
            variant="outline"
            className="w-full"
          >
            View Plan Details
          </Button>
        </div>

        <p className="text-xs text-slate-500 mt-6">
          You'll receive a confirmation email from Stripe shortly
        </p>
      </div>
    </div>
  );
}