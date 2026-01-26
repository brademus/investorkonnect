import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
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
  const { profile, refresh, loading, kycVerified, onboarded } = useCurrentProfile();
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState('pending'); // pending, verifying, success, error

  // Redirect if already verified
  useEffect(() => {
    if (!loading && kycVerified) {
      navigate(createPageUrl("NDA"), { replace: true });
    }
  }, [loading, kycVerified, navigate]);

  // Check if user should be here - redirect to onboarding if not complete
  useEffect(() => {
    if (!loading && !profile) {
      navigate(createPageUrl("PostAuth"), { replace: true });
    } else if (!loading && profile && !onboarded) {
      const role = profile.user_role;
      if (role === 'investor') {
        navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl("AgentOnboarding"), { replace: true });
      }
    }
  }, [loading, profile, navigate]);

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
      while (attempts < 8) {
        const { data: statusData } = await base44.functions.invoke('getStripeIdentityStatus', { session_id: sessionId });
        const s = statusData?.status;
        if (s === 'verified') {
          finalStatus = 'verified';
          break;
        }
        if (s === 'requires_input' || s === 'canceled') {
          finalStatus = 'error';
          break;
        }
        await new Promise(r => setTimeout(r, 1500));
        attempts += 1;
      }

      if (finalStatus === 'verified') {
        setStatus('success');
        toast.success('Identity verified successfully!');
        await refresh();
        setTimeout(() => {
          navigate(createPageUrl('NDA'), { replace: true });
        }, 800);
      } else {
        throw new Error('Verification not completed. Please try again.');
      }

    } catch (error) {
      console.error('Verification error:', error);
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
                onClick={() => { setStatus('pending'); setVerifying(false); }}
                className="bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold px-8 py-3"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-[#E3C567]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-10 h-10 text-[#E3C567]" />
                </div>
                <h2 className="text-3xl font-bold text-[#E3C567] mb-4">Verify Your Identity</h2>
                <p className="text-[#808080]">
                  To protect our community and ensure secure transactions, we need to verify your identity.
                </p>
              </div>

              <div className="bg-[#141414] rounded-xl p-6 mb-8 border border-[#1F1F1F]">
                <h3 className="font-semibold text-[#FAFAFA] mb-3">Verifying as:</h3>
                <p className="text-xl text-[#E3C567] font-bold">{profile?.full_name || 'Unknown'}</p>
                <p className="text-sm text-[#808080] mt-2">{profile?.email}</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#E3C567] mt-0.5 flex-shrink-0" />
                  <p className="text-[#FAFAFA] text-sm">Your information is encrypted and secure</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#E3C567] mt-0.5 flex-shrink-0" />
                  <p className="text-[#FAFAFA] text-sm">Verification takes less than 2 minutes</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#E3C567] mt-0.5 flex-shrink-0" />
                  <p className="text-[#FAFAFA] text-sm">Required for all investors and agents</p>
                </div>
              </div>

              <Button
                onClick={handleStartVerification}
                disabled={verifying}
                className="w-full h-14 bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold text-lg"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify My Identity'
                )}
              </Button>

              <p className="text-center text-xs text-[#666666] mt-6">
                By clicking verify, you agree to our identity verification process powered by Stripe Identity.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}