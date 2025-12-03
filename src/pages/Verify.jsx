import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { Loader2, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * IDENTITY VERIFICATION (Persona Embedded Flow)
 * 
 * Uses the Persona embedded SDK to display the verification modal
 * directly on this page (not a redirect).
 */
function VerifyContent() {
  const navigate = useNavigate();
  const { user, profile, kycVerified, refresh } = useCurrentProfile();
  
  const [launching, setLaunching] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [personaReady, setPersonaReady] = useState(false);
  
  const personaClientRef = useRef(null);

  // Load Persona SDK script
  useEffect(() => {
    if (window.Persona) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.0.0.js';
    script.async = true;
    script.onload = () => {
      console.log('[Verify] Persona SDK loaded');
      setScriptLoaded(true);
    };
    script.onerror = () => {
      console.error('[Verify] Failed to load Persona SDK');
      setError('Failed to load verification system. Please refresh the page.');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script if component unmounts before load
    };
  }, []);

  // Initialize Persona client once SDK is loaded and we have profile
  useEffect(() => {
    if (!scriptLoaded || !user || !profile || personaClientRef.current) return;

    const templateId = 'itmpl_8nKgVFgnwC1iGv6ZBHmJaSnn';
    const environmentId = 'env_vSBBJVqRsaNLyvJ7C7vN8C5c';

    console.log('[Verify] Initializing Persona client...');

    try {
      personaClientRef.current = new window.Persona.Client({
        templateId,
        environmentId,
        referenceId: user.id,
        prefill: {
          emailAddress: user.email,
          nameFirst: profile.full_name?.split(' ')[0] || '',
          nameLast: profile.full_name?.split(' ').slice(1).join(' ') || '',
        },
        onReady: () => {
          console.log('[Verify] Persona client ready');
          setPersonaReady(true);
        },
        onComplete: async ({ inquiryId, status }) => {
          console.log('[Verify] Persona complete:', { inquiryId, status });
          setVerifying(true);
          
          try {
            // Update profile with KYC status
            await base44.entities.Profile.update(profile.id, {
              kyc_status: status === 'completed' ? 'approved' : 'pending',
              kyc_inquiry_id: inquiryId,
              kyc_provider: 'persona',
              kyc_last_checked: new Date().toISOString(),
            });
            
            toast.success('Identity verified successfully!');
            await refresh();
            navigate(createPageUrl("Dashboard"), { replace: true });
          } catch (err) {
            console.error('[Verify] Error updating profile:', err);
            setError('Verification completed but failed to update profile. Please contact support.');
            setVerifying(false);
          }
        },
        onCancel: () => {
          console.log('[Verify] Persona cancelled');
          setLaunching(false);
        },
        onError: (error) => {
          console.error('[Verify] Persona error:', error);
          setError('Verification encountered an error. Please try again.');
          setLaunching(false);
        },
      });

      setReady(true);
    } catch (err) {
      console.error('[Verify] Failed to initialize Persona:', err);
      setError('Failed to initialize verification. Please refresh the page.');
    }
  }, [scriptLoaded, user, profile, navigate, refresh]);

  // DEMO MODE: Auto-approve KYC
  useEffect(() => {
    if (!user || !profile) return;
    
    if (DEMO_MODE && DEMO_CONFIG.autoApproveKYC && !kycVerified) {
      setVerifying(true);
      
      setTimeout(async () => {
        const demoProfile = JSON.parse(sessionStorage.getItem('demo_profile') || '{}');
        demoProfile.kyc_status = 'approved';
        demoProfile.identity_verified = true;
        demoProfile.kyc_last_checked = new Date().toISOString();
        sessionStorage.setItem('demo_profile', JSON.stringify(demoProfile));
        
        toast.success('Identity verified successfully!');
        await refresh();
        navigate(createPageUrl("Dashboard"), { replace: true });
      }, 2000);
      
      return;
    }
  }, [user, profile, kycVerified, navigate, refresh]);

  // Redirect if already verified
  useEffect(() => {
    if (!user || !profile) return;
    
    if (kycVerified) {
      navigate(createPageUrl("Dashboard"), { replace: true });
    }
  }, [user, profile, kycVerified, navigate]);

  // Redirect if not onboarded
  useEffect(() => {
    if (!user || !profile) return;
    
    const hasCompletedOnboarding = !!profile.onboarding_completed_at;
    
    if (!hasCompletedOnboarding) {
      const role = profile.user_role || profile.user_type;
      if (role === 'investor') {
        navigate(createPageUrl("InvestorDeepOnboarding"), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl("AgentDeepOnboarding"), { replace: true });
      } else {
        navigate(createPageUrl("Dashboard"), { replace: true });
      }
    }
  }, [user, profile, navigate]);

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
    setError(null);
    
    try {
      personaClientRef.current.open();
    } catch (err) {
      console.error('[Verify] Failed to open Persona:', err);
      setError('Failed to start verification. Please refresh and try again.');
      setLaunching(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLaunching(false);
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
                Loading Verification System...
              </h3>
              <p className="text-[#666666]">Please wait</p>
            </div>
          )}

          {/* Loading State: Client Initializing */}
          {scriptLoaded && !personaReady && !error && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent mx-auto mb-4" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }}></div>
              <h3 className="text-lg font-semibold text-black mb-2">
                Preparing Verification...
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
                className="h-14 px-8 rounded-xl bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:-translate-y-0.5 flex items-center justify-center mx-auto"
              >
                {launching ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" />
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