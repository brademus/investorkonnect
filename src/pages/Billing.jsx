import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { billingPortal } from "@/components/functions";
import LoadingAnimation from "@/components/LoadingAnimation";

/**
 * BILLING PAGE - Redirects to Stripe Billing Portal
 * 
 * Opens the Stripe Customer Portal for subscription management
 */
export default function Billing() {
  useEffect(() => {
    let mounted = true;

    const openBillingPortal = async () => {
      try {
        console.log('[Billing] Opening Stripe Billing Portal...');
        
        const response = await billingPortal();
        
        if (!mounted) return;
        
        if (response.data?.ok && response.data?.url) {
          console.log('[Billing] Redirecting to Stripe portal...');
          window.location.assign(response.data.url);
        } else {
          const error = response.data?.error || 'Unable to open billing portal';
          console.error('[Billing] Error:', error);
          alert(`${error}. Redirecting to Pricing.`);
          window.location.assign('/Pricing');
        }
      } catch (error) {
        console.error('[Billing] Exception:', error);
        if (mounted) {
          alert('Billing portal error. Redirecting to Pricing.');
          window.location.assign('/Pricing');
        }
      }
    };

    openBillingPortal();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Opening Stripe Billing Portal...
        </h2>
        <p className="text-sm text-slate-600">
          You'll be redirected to manage your subscription
        </p>
      </div>
    </div>
  );
}