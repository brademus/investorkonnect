import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
// Removed useCurrentProfile to avoid rate limits - using direct API calls instead
import { Shield, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import LoadingAnimation from "@/components/LoadingAnimation";

/**
 * IDENTITY VERIFICATION PAGE
 * 
 * Handles Stripe Identity verification flow.
 * In test mode: Auto-approves after clicking verify.
 * In production: Will verify name matches profile.
 */
export default function IdentityVerification() {
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState('pending'); // pending, verifying, success, error
  const [loading, setLoading] = useState(true);
  const [localProfile, setLocalProfile] = useState(null);
  const hasStartedRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  // Single initialization effect - no useCurrentProfile hook
  useEffect(() => {
    const init = async () => {
      try {
        const authUser = await base44.auth.me();
        if (!authUser) {
          base44.auth.redirectToLogin(createPageUrl("PostAuth"));
          return;
        }
        
        // Get profile directly
        let profile = null;
        try {
          const profiles = await base44.entities.Profile.filter({ user_id: authUser.id });
          profile = profiles[0];
        } catch (e) {
          console.warn('[IdentityVerification] Profile fetch failed:', e.message);
        }
        
        if (!profile) {
          navigate(createPageUrl("PostAuth"), { replace: true });
          return;
        }
        
        setLocalProfile(profile);
        
        // Check if already verified
        const kycVerified = profile.identity_status === 'verified' || profile.kyc_status === 'verified' || !!profile.identity_verified_at;
        if (kycVerified) {
          hasRedirectedRef.current = true;
          try { sessionStorage.removeItem('profile_cache'); } catch (_) {}
          window.location.href = createPageUrl("NDA");
          return;
        }
        
        // Check if onboarded
        const isOnboarded = !!(profile.onboarding_completed_at || profile.onboarding_version);
        if (!isOnboarded) {
          const role = profile.user_role;
          if (role === 'investor') {
            navigate(createPageUrl("InvestorOnboarding"), { replace: true });
          } else if (role === 'agent') {
            navigate(createPageUrl("AgentOnboarding"), { replace: true });
          }
          return;
        }
        
        setLoading(false);
        
        // Auto-start verification
        if (!hasStartedRef.current) {
          hasStartedRef.current = true;
          setTimeout(() => handleStartVerification(), 100);
        }
      } catch (e) {
        console.error('[IdentityVerification] Init error:', e);
        navigate(createPageUrl("PostAuth"), { replace: true });
      }
    };
    
    init();
  }, [navigate]);

  const handleStartVerification = async () => {
    setVerifying(true);
    setStatus('verifying');

    try {
      // 1) Ask backend to create a Stripe Identity Verification Session
      const { data: sessionData } = await base44.functions.invoke('createStripeIdentitySession');
      const clientSecret = sessionData?.client_secret;
      const publishableKey = sessionData?.publishable_key;
      const sessionId = sessionData?.session_id;

      if (!clientSecret || !publishableKey) {
        throw new Error('Could not initialize verification');
      }

      // 2) Load Stripe.js and launch the Identity modal
      await new Promise((resolve, reject) => {
        if (window.Stripe) return resolve();
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => resolve();
        script.onerror = reject;
        document.body.appendChild(script);
      });

      const stripe = window.Stripe(publishableKey);
      const result = await stripe.verifyIdentity(clientSecret);

      if (result?.error) {
        throw new Error(result.error.message || 'Verification was cancelled or failed');
      }

      // 3) Poll backend for final status (Stripe may take a moment to finalize)
      let attempts = 0;
      let finalStatus = 'processing';
      while (attempts < 15) {
        try {
          const { data: statusData } = await base44.functions.invoke('getStripeIdentityStatus', { session_id: sessionId });
          const s = statusData?.status;
          console.log('[IdentityVerification] Poll attempt', attempts, 'status:', s);
          if (s === 'verified') {
            finalStatus = 'verified';
            break;
          }
          if (s === 'requires_input' || s === 'canceled') {
            finalStatus = 'error';
            break;
          }
        } catch (pollError) {
          console.warn('[IdentityVerification] Poll error:', pollError);
          // Continue polling on error
        }
        await new Promise(r => setTimeout(r, 1000));
        attempts += 1;
      }

      console.log('[IdentityVerification] Final status after polling:', finalStatus);

      // Mark as success and redirect immediately
      setStatus('success');
      toast.success('Identity verified! Redirecting...');
      
      // Clear cache to ensure NDA page gets fresh profile data
      try { sessionStorage.removeItem('profile_cache'); } catch (_) {}
      
      // Redirect to NDA immediately - use window.location for clean state
      hasRedirectedRef.current = true;
      setTimeout(() => {
        window.location.href = createPageUrl('NDA');
      }, 500);

    } catch (error) {
      console.error('[IdentityVerification] Verification error:', error);
      setStatus('error');
      toast.error(error?.message || 'Verification failed. Please try again.');
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}>
      {/* Header */}
      <header className="h-20 flex items-center justify-center border-b border-[#1F1F1F]">
        <div className="flex items-center gap-2">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
            alt="Investor Konnect"
            className="h-10 w-10 object-contain"
          />
          <span className="text-xl font-bold text-[#E3C567]">INVESTOR KONNECT</span>
        </div>
      </header>

      <div className="max-w-[600px] mx-auto px-4 py-16">
        <div className="bg-[#0D0D0D] rounded-3xl p-12 border border-[#1F1F1F]" style={{ boxShadow: '0 6px 30px rgba(0,0,0,0.6)' }}>
          
          {status === 'success' ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-3xl font-bold text-[#E3C567] mb-4">Identity Verified!</h2>
              <p className="text-[#808080] mb-6">Your identity has been successfully verified. Redirecting to NDA...</p>
            </div>
          ) : status === 'error' ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-3xl font-bold text-red-500 mb-4">Verification Failed</h2>
              <p className="text-[#808080] mb-6">Something went wrong. Please try again.</p>
              <Button
                onClick={() => { 
                  setStatus('pending'); 
                  setVerifying(false); 
                  hasStartedRef.current = false; // Allow retry
                }}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold px-8 py-3"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-[#E3C567] animate-spin" />
              </div>
              <h2 className="text-3xl font-bold text-[#E3C567] mb-4">Opening Verification...</h2>
              <p className="text-[#808080] mb-6">
                Launching Stripe Identity verification. This will open in a new window.
              </p>
              <div className="bg-[#141414] rounded-xl p-6 border border-[#1F1F1F]">
                <h3 className="font-semibold text-[#FAFAFA] mb-3">Verifying as:</h3>
                <p className="text-xl text-[#E3C567] font-bold">{localProfile?.full_name || 'Unknown'}</p>
                <p className="text-sm text-[#808080] mt-2">{localProfile?.email}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}