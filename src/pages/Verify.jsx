import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { Loader2, Shield, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * IDENTITY VERIFICATION (Persona Embedded Flow)
 * 
 * CRITICAL: This page should ONLY be shown to users who have:
 * - Completed onboarding
 * - NOT yet verified KYC
 * 
 * Once KYC is verified, redirect immediately to NDA or Dashboard
 */
function VerifyContent() {
  const navigate = useNavigate();
  const { user, profile, kycVerified, hasNDA, onboarded, refresh } = useCurrentProfile();
  
  const personaClientRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [personaReady, setPersonaReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  // DEMO MODE: Auto-approve KYC
  useEffect(() => {
    if (!user || !profile) return;
    
    if (DEMO_MODE && DEMO_CONFIG.autoApproveKYC && !kycVerified) {
      setVerifying(true);
      
      setTimeout(async () => {
        // Update demo profile in sessionStorage
        const demoProfile = JSON.parse(sessionStorage.getItem('demo_profile') || '{}');
        demoProfile.kyc_status = 'approved';
        demoProfile.identity_verified = true;
        demoProfile.kyc_last_checked = new Date().toISOString();
        sessionStorage.setItem('demo_profile', JSON.stringify(demoProfile));
        
        toast.success('Identity verified successfully!');
        await refresh();
        
        navigate(createPageUrl("NDA"), { replace: true });
      }, 2000);
      
      return;
    }
  }, [user, profile, kycVerified, navigate, refresh]);

  // Redirect if already verified
  useEffect(() => {
    if (!user || !profile) return;
    
    if (kycVerified) {
      if (hasNDA) {
        navigate(createPageUrl("Dashboard"), { replace: true });
      } else {
        navigate(createPageUrl("NDA"), { replace: true });
      }
    }
  }, [user, profile, kycVerified, hasNDA, navigate]);

  // Redirect if not onboarded
  useEffect(() => {
    if (!user || !profile) return;
    
    if (!onboarded) {
      navigate(createPageUrl("Dashboard"), { replace: true });
    }
  }, [user, profile, onboarded, navigate]);

  // Load Persona script
  useEffect(() => {
    if (window.Persona) {
      setScriptLoaded(true);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.1.2.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      setScriptLoaded(true);
    };
    
    script.onerror = () => {
      setError('Failed to load verification system. Please refresh the page.');
    };

    document.body.appendChild(script);

    return () => {
      if (!scriptLoaded && script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, [scriptLoaded]); // Added scriptLoaded to deps to ensure cleanup logic is current

  // Initialize Persona client when script is loaded
  useEffect(() => {
    if (!scriptLoaded || !window.Persona || !user || !profile) {
      return;
    }

    if (kycVerified) {
      return;
    }

    try {
      const client = new window.Persona.Client({
        templateId: 'itmpl_S55mLQgAGrNb2VbRzCjKN9xSv6xM',
        environmentId: 'env_JYPpWD9CCQRPNSQ2hy6A26czau5H',
        referenceId: user.id,
        
        onReady: () => {
          setPersonaReady(true);
          setLaunching(false);
        },
        
        onComplete: async ({ inquiryId, status, fields }) => {
          console.log('[Verify] Inquiry completed:', { inquiryId, status });
          
          setVerifying(true);
          
          try {
            // Call backend to validate and update profile
            console.log('[Verify] Calling personaFinalize...');
            const response = await base44.functions.invoke('personaFinalize', {
              inquiryId,
              status
            });

            if (response.data?.ok) {
              const kycStatus = response.data.kyc_status;
              
              // ALSO update profile directly to ensure all flags are set
              try {
                const profiles = await base44.entities.Profile.filter({ user_id: user.id });
                if (profiles.length > 0) {
                  await base44.entities.Profile.update(profiles[0].id, {
                    kyc_status: kycStatus,
                    kyc_inquiry_id: inquiryId,
                    kyc_last_checked: new Date().toISOString(),
                  });
                }
              } catch (updateErr) {
                // Continue anyway since backend function may have done it
              }
              
              if (kycStatus === 'approved') {
                toast.success('Identity verified successfully!');
                
                // Force profile refresh
                await refresh();
                
                // Small delay to ensure state is updated
                await new Promise(resolve => setTimeout(resolve, 500));
                
                navigate(createPageUrl("NDA"), { replace: true });
              } else if (kycStatus === 'needs_review') {
                toast.info('Verification under review. We\'ll notify you when complete.');
                navigate(createPageUrl("Dashboard"), { replace: true });
              } else if (kycStatus === 'failed') {
                toast.error('Verification failed. Please contact support.');
                setVerifying(false);
                setError('Verification could not be completed. Please contact support for assistance.');
              } else {
                toast.info('Verification in progress. This may take a few moments.');
                setVerifying(false);
              }
            } else {
              throw new Error('Failed to update verification status');
            }
          } catch (err) {
            toast.error('Could not complete verification. Please try again.');
            setVerifying(false);
            setError('We verified your identity but encountered an error saving it. Please refresh and try again.');
          }
        },
        
        onCancel: ({ inquiryId }) => {
          toast.info('Verification cancelled');
          setLaunching(false);
        },
        
        onError: (error) => {
          toast.error('Verification error occurred');
          setLaunching(false);
          setError('An error occurred during verification. Please try again.');
        }
      });

      personaClientRef.current = client;

    } catch (err) {
      setError('Failed to initialize verification. Please refresh the page.');
    }

  }, [scriptLoaded, user, profile, kycVerified, navigate, refresh]);

  // Verification in progress
  if (verifying) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
        <div className="text-center max-w-md">
          <div className="bg-white rounded-3xl border border-[#E5E5E5] p-12 shadow-lg">
            <div className="animate-spin rounded-full h-16 w-16 border-2 border-t-transparent mx-auto mb-6" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }}></div>
            <h2 className="text-[28px] font-bold text-black mb-2">Processing Verification...</h2>
            <p className="text-[#666666]">Please wait while we confirm your identity</p>
          </div>
        </div>
      </div>
    );
  }

  const handleBeginVerification = () => {
    if (!personaClientRef.current) {
      setError('Verification system not ready. Please refresh the page.');
      return;
    }

    setLaunching(true);
    
    try {
      personaClientRef.current.open();
    } catch (err) {
      setError('Failed to start verification. Please refresh and try again.');
      setLaunching(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setScriptLoaded(false);
    setPersonaReady(false);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      {/* Header */}
      <header className="h-20 flex items-center justify-center border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-black">INVESTOR KONNECT</span>
        </div>
      </header>

      <div className="max-w-[600px] mx-auto px-4 py-12">
        
        {/* Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Shield className="w-10 h-10 text-[#92400E]" />
          </div>
          <h1 className="text-[32px] font-bold text-black mb-2">Verify Your Identity</h1>
          <p className="text-[16px] text-[#666666] leading-relaxed max-w-md mx-auto">
            Required to access agent profiles and deal rooms. Your data is encrypted and used only for verification.
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center hover:border-[#D4AF37] transition-all">
            <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h4 className="font-semibold text-sm text-black mb-1">Secure & Private</h4>
            <p className="text-xs text-[#666666]">Bank-level encryption</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center hover:border-[#D4AF37] transition-all">
            <div className="w-10 h-10 bg-[#D1FAE5] rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5 text-[#059669]" />
            </div>
            <h4 className="font-semibold text-sm text-black mb-1">Fast & Easy</h4>
            <p className="text-xs text-[#666666]">Takes 2-3 minutes</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center hover:border-[#D4AF37] transition-all">
            <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h4 className="font-semibold text-sm text-black mb-1">One-Time Only</h4>
            <p className="text-xs text-[#666666]">Verify once, forever</p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-[#E5E5E5] p-8 shadow-lg">
          
          {/* Error State */}
          {error && (
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-[#991B1B] mb-1">Verification Error</h4>
                  <p className="text-sm text-[#7F1D1D]">{error}</p>
                </div>
              </div>
              <button
                onClick={handleRetry}
                className="mt-4 h-10 px-4 rounded-lg border-2 border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2] font-medium transition-all"
              >
                Retry Verification
              </button>
            </div>
          )}

          {/* Loading State: Script Loading */}
          {!scriptLoaded && !error && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent mx-auto mb-4" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }}></div>
              <h3 className="text-lg font-semibold text-black mb-2">
                Preparing Secure Verification...
              </h3>
              <p className="text-[#666666]">Loading verification system</p>
            </div>
          )}

          {/* Loading State: Client Initializing */}
          {scriptLoaded && !personaReady && !error && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent mx-auto mb-4" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }}></div>
              <h3 className="text-lg font-semibold text-black mb-2">
                Initializing Verification...
              </h3>
              <p className="text-[#666666]">Setting up your secure session</p>
            </div>
          )}

          {/* Ready to Verify */}
          {personaReady && !error && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <Shield className="w-12 h-12 text-[#92400E]" />
              </div>
              
              <h3 className="text-[24px] font-bold text-black mb-3">
                Ready to Verify
              </h3>
              
              <p className="text-[#666666] mb-8 max-w-md mx-auto">
                Click below to open the secure verification window. You'll need:
              </p>

              <div className="grid gap-3 max-w-sm mx-auto mb-8 text-left">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#059669] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#333333]">A valid government-issued ID</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#059669] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#333333]">Your phone or webcam</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-[#059669] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#333333]">2-3 minutes of your time</span>
                </div>
              </div>

              <button
                onClick={handleBeginVerification}
                disabled={launching}
                className="h-14 px-8 rounded-xl bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:-translate-y-0.5"
              >
                {launching ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                    Opening Verification...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2 inline" />
                    Begin Verification
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-[#999999] text-center mt-6">
          Powered by Persona. Your data is encrypted and never shared.
        </p>
      </div>
    </div>
  );
}

export default function Verify() {
  return <VerifyContent />;
}