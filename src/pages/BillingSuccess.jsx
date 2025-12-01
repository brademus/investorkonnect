import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { CheckCircle, Loader2, ArrowRight, AlertCircle } from "lucide-react";

/**
 * BILLING SUCCESS PAGE
 * 
 * After successful Stripe checkout, user lands here via /BillingSuccess?session_id=...
 * We sync their subscription from Stripe to our database, show success for 2-3 seconds,
 * then redirect to Dashboard.
 * 
 * NEW: For READY investors, also triggers AI matching after subscription sync
 */
export default function BillingSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refresh, subscriptionPlan, subscriptionStatus } = useCurrentProfile();
  
  const [state, setState] = useState({
    syncing: true,
    matching: false,
    error: null,
    redirecting: false
  });
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    document.title = "Subscription Active! - Investor Konnect";
  }, []);

  useEffect(() => {
    // Redirect immediately if no session_id
    if (!sessionId) {
      console.log('[BillingSuccess] No session_id, redirecting to Dashboard');
      navigate(createPageUrl("Dashboard"), { replace: true });
      return;
    }

    // Wait for user and profile to load (with timeout)
    if (!user || !profile) {
      console.log('[BillingSuccess] Waiting for user/profile...', { user: !!user, profile: !!profile });
      
      // Timeout: If user/profile doesn't load in 10 seconds, redirect anyway
      const timeout = setTimeout(() => {
        console.error('[BillingSuccess] Timeout waiting for user/profile');
        navigate(createPageUrl("Dashboard"), { replace: true });
      }, 10000);
      
      return () => clearTimeout(timeout);
    }

    // Prevent multiple executions
    let executed = false;

    const syncAndRedirect = async () => {
      if (executed) {
        console.log('[BillingSuccess] Already executed, skipping');
        return;
      }
      executed = true;
      
      console.log('[BillingSuccess] Starting subscription sync...', { sessionId });

      try {
        const response = await base44.functions.invoke('syncSubscription', {
          session_id: sessionId
        });

        console.log('[BillingSuccess] Sync response:', response.data);

        if (response.data?.ok) {
          // Refresh profile to get updated subscription
          await refresh();
          console.log('[BillingSuccess] Profile refreshed');
          
          // For READY investors, trigger AI matching
          if (profile.user_role === 'investor') {
            const isOnboarded = 
              profile.onboarding_version === 'v2' &&
              profile.onboarding_completed_at;
            
            const isKYCVerified = profile.kyc_status === 'approved';
            const hasNDA = profile.nda_accepted;
            
            if (isOnboarded && isKYCVerified && hasNDA) {
              console.log('[BillingSuccess] Starting AI matching...');
              setState(prev => ({ ...prev, syncing: false, matching: true }));
              
              try {
                await base44.functions.invoke('matchInvestor', {});
                await refresh();
                console.log('[BillingSuccess] Matching complete');
              } catch (matchErr) {
                console.error('[BillingSuccess] Matching failed:', matchErr);
                // Don't block on match failure
              }
            }
          }
          
          // Show success state
          setState({ syncing: false, matching: false, error: null, redirecting: false });
          
          // Wait 2.5 seconds, then redirect
          setTimeout(() => {
            console.log('[BillingSuccess] Starting redirect countdown...');
            setState(prev => ({ ...prev, redirecting: true }));
            
            setTimeout(() => {
              console.log('[BillingSuccess] Redirecting to Dashboard');
              navigate(createPageUrl("Dashboard"), { replace: true });
            }, 500);
          }, 2500);
          
        } else {
          // Sync failed but payment succeeded
          const errorMsg = response.data?.message || "Failed to sync subscription";
          console.error('[BillingSuccess] Sync failed:', errorMsg);
          setState({ syncing: false, matching: false, error: errorMsg, redirecting: false });
          
          // Try to refresh anyway
          try {
            await refresh();
          } catch (refreshErr) {
            console.error('[BillingSuccess] Refresh failed:', refreshErr);
          }
          
          // Redirect after 5 seconds even on error
          setTimeout(() => {
            console.log('[BillingSuccess] Redirecting after error');
            navigate(createPageUrl("Dashboard"), { replace: true });
          }, 5000);
        }
      } catch (err) {
        console.error('[BillingSuccess] Fatal error:', err);
        setState({ 
          syncing: false,
          matching: false,
          error: "Could not sync subscription. Your payment was successful but we couldn't update your account. Please refresh the page.", 
          redirecting: false 
        });
        
        // Try to refresh anyway
        try {
          await refresh();
        } catch (refreshErr) {
          console.error('[BillingSuccess] Refresh failed after error:', refreshErr);
        }
        
        // Redirect after 5 seconds
        setTimeout(() => {
          console.log('[BillingSuccess] Redirecting after fatal error');
          navigate(createPageUrl("Dashboard"), { replace: true });
        }, 5000);
      }
    };

    syncAndRedirect();

    // Cleanup function
    return () => {
      executed = true; // Prevent execution if component unmounts
    };
  }, [sessionId, user, profile]);

  // Safety timeout: Force redirect after 30 seconds no matter what
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      console.warn('[BillingSuccess] Safety timeout triggered - forcing redirect');
      navigate(createPageUrl("Dashboard"), { replace: true });
    }, 30000); // 30 seconds

    return () => clearTimeout(safetyTimeout);
  }, [navigate]);

  const getPlanName = (plan) => {
    const names = {
      'starter': 'Starter',
      'pro': 'Pro',
      'enterprise': 'Enterprise'
    };
    return names[plan] || plan;
  };

  // Syncing state
  if (state.syncing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-16 h-16 text-emerald-600 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Payment Successful!
          </h2>
          <p className="text-slate-600 leading-relaxed">
            We're updating your subscription...
          </p>
        </div>
      </div>
    );
  }

  // Matching state
  if (state.matching) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-blue-200 p-12 text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Finding Your Perfect Agent Match
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Our AI is analyzing your profile and matching you with the best investor-friendly agents in your market...
          </p>
        </div>
      </div>
    );
  }

  // Error state (still shows success since payment went through)
  if (state.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-orange-200 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Payment Successful!
          </h2>
          <p className="text-slate-600 mb-4">
            Your payment was processed successfully.
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2 text-left">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">{state.error}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Redirecting to dashboard in a moment...
          </p>
        </div>
      </div>
    );
  }

  // Success state with redirect countdown
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-emerald-200 p-12 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          🎉 Welcome to {getPlanName(subscriptionPlan)}!
        </h1>
        
        <p className="text-lg text-slate-600 mb-6">
          Your subscription is now active
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-700 font-medium">Plan:</span>
            <span className="text-emerald-800 font-bold">{getPlanName(subscriptionPlan)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700 font-medium">Status:</span>
            <span className="text-emerald-800 font-bold capitalize">{subscriptionStatus}</span>
          </div>
        </div>

        {state.redirecting ? (
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to dashboard...</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Taking you to your dashboard...
          </p>
        )}
      </div>
    </div>
  );
}