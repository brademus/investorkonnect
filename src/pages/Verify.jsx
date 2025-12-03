import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DEMO_MODE, DEMO_CONFIG } from "@/components/config/demo";
import { Loader2, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Persona configuration - using your secrets
const PERSONA_TEMPLATE_ID = 'itmpl_8nKgVFgnwC1iGv6ZBHmJaSnn';
const PERSONA_ENV_ID = 'env_vSBBJVqRsaNLyvJ7C7vN8C5c';

/**
 * IDENTITY VERIFICATION (Persona Embedded Flow)
 */
function VerifyContent() {
  const navigate = useNavigate();
  const { user, profile, kycVerified, refresh, loading: profileLoading } = useCurrentProfile();
  
  const [launching, setLaunching] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState('Initializing...');
  
  const personaClientRef = useRef(null);
  const initAttempted = useRef(false);

  // Load Persona SDK script
  useEffect(() => {
    // Check if already loaded
    if (window.Persona) {
      console.log('[Verify] Persona already on window');
      setScriptLoaded(true);
      setDebugInfo('SDK already loaded');
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="persona"]');
    if (existingScript) {
      console.log('[Verify] Script tag exists, waiting...');
      existingScript.onload = () => {
        setScriptLoaded(true);
        setDebugInfo('SDK loaded from existing script');
      };
      return;
    }

    console.log('[Verify] Adding Persona script...');
    setDebugInfo('Loading SDK...');
    
    const script = document.createElement('script');
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.0.0.js';
    script.async = true;
    
    script.onload = () => {
      console.log('[Verify] Script onload fired, window.Persona:', !!window.Persona);
      setScriptLoaded(true);
      setDebugInfo('SDK loaded');
    };
    
    script.onerror = (e) => {
      console.error('[Verify] Script load error:', e);
      setError('Failed to load Persona SDK. Please check your internet connection.');
      setDebugInfo('SDK load failed');
    };
    
    document.head.appendChild(script);
  }, []);

  // Initialize Persona client
  const initializeClient = useCallback(() => {
    if (!window.Persona) {
      console.log('[Verify] No window.Persona yet');
      return false;
    }
    
    if (!user?.id || !profile?.id) {
      console.log('[Verify] No user/profile yet');
      return false;
    }
    
    if (personaClientRef.current) {
      console.log('[Verify] Client already exists');
      return true;
    }

    console.log('[Verify] Creating Persona.Client...', {
      templateId: PERSONA_TEMPLATE_ID,
      environmentId: PERSONA_ENV_ID,
      userId: user.id
    });
    
    setDebugInfo('Creating client...');

    try {
      const client = new window.Persona.Client({
        templateId: PERSONA_TEMPLATE_ID,
        environmentId: PERSONA_ENV_ID,
        referenceId: user.id,
        prefill: {
          emailAddress: user.email || '',
          nameFirst: profile.full_name?.split(' ')[0] || '',
          nameLast: profile.full_name?.split(' ').slice(1).join(' ') || '',
        },
        onReady: () => {
          console.log('[Verify] ✅ onReady callback fired!');
          setClientReady(true);
          setDebugInfo('Ready!');
        },
        onComplete: async ({ inquiryId, status }) => {
          console.log('[Verify] onComplete:', { inquiryId, status });
          setVerifying(true);
          
          try {
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
            console.error('[Verify] Update error:', err);
            setError('Verification completed but failed to save. Please contact support.');
            setVerifying(false);
          }
        },
        onCancel: () => {
          console.log('[Verify] onCancel');
          setLaunching(false);
        },
        onError: (err) => {
          console.error('[Verify] onError:', err);
          setError('Verification error. Please try again.');
          setLaunching(false);
        },
      });
      
      personaClientRef.current = client;
      console.log('[Verify] Client created successfully');
      setDebugInfo('Client created, waiting for onReady...');
      return true;
    } catch (err) {
      console.error('[Verify] Client creation failed:', err);
      setError(`Failed to initialize: ${err.message}`);
      setDebugInfo(`Error: ${err.message}`);
      return false;
    }
  }, [user, profile, navigate, refresh]);

  // Try to initialize when ready
  useEffect(() => {
    if (scriptLoaded && user && profile && !initAttempted.current) {
      initAttempted.current = true;
      // Small delay to ensure Persona is fully ready
      setTimeout(() => {
        initializeClient();
      }, 100);
    }
  }, [scriptLoaded, user, profile, initializeClient]);

  // DEMO MODE: Auto-approve
  useEffect(() => {
    if (!user || !profile) return;
    
    if (DEMO_MODE && DEMO_CONFIG.autoApproveKYC && !kycVerified) {
      setVerifying(true);
      setTimeout(async () => {
        const demoProfile = JSON.parse(sessionStorage.getItem('demo_profile') || '{}');
        demoProfile.kyc_status = 'approved';
        demoProfile.identity_verified = true;
        sessionStorage.setItem('demo_profile', JSON.stringify(demoProfile));
        toast.success('Identity verified!');
        await refresh();
        navigate(createPageUrl("Dashboard"), { replace: true });
      }, 2000);
    }
  }, [user, profile, kycVerified, navigate, refresh]);

  // Redirect if already verified - check DATABASE status only, not derived kycVerified
  useEffect(() => {
    if (user && profile) {
      const actualKycStatus = profile.kyc_status;
      console.log('[Verify] Checking KYC status:', { 
        kyc_status: actualKycStatus,
        derivedKycVerified: kycVerified,
        isAdmin: user.role === 'admin' || profile.role === 'admin'
      });
      
      // Only redirect if ACTUALLY approved in database (not admin bypass)
      if (actualKycStatus === 'approved') {
        console.log('[Verify] KYC is approved in DB, redirecting to dashboard');
        navigate(createPageUrl("Dashboard"), { replace: true });
      }
    }
  }, [user, profile, kycVerified, navigate]);

  // Redirect if not onboarded
  useEffect(() => {
    if (!user || !profile) return;
    if (!profile.onboarding_completed_at) {
      const role = profile.user_role || profile.user_type;
      if (role === 'investor') {
        navigate(createPageUrl("InvestorDeepOnboarding"), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl("AgentDeepOnboarding"), { replace: true });
      }
    }
  }, [user, profile, navigate]);

  // Handle button click
  const handleBeginVerification = () => {
    console.log('[Verify] Button clicked');
    console.log('[Verify] clientRef:', !!personaClientRef.current);
    console.log('[Verify] clientReady:', clientReady);
    
    if (!personaClientRef.current) {
      // Try to init again
      const success = initializeClient();
      if (!success) {
        setError('Verification not ready. Please refresh the page.');
        return;
      }
    }

    setLaunching(true);
    setError(null);
    
    try {
      console.log('[Verify] Calling client.open()...');
      personaClientRef.current.open();
      console.log('[Verify] open() called');
    } catch (err) {
      console.error('[Verify] open() failed:', err);
      setError(`Failed to open: ${err.message}`);
      setLaunching(false);
    }
  };

  // Verifying state
  if (verifying) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-3xl border border-[#E5E5E5] p-12 shadow-lg">
            <Loader2 className="w-16 h-16 text-[#D4AF37] animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-black mb-2">Processing...</h2>
            <p className="text-gray-600">Please wait</p>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = profileLoading || !scriptLoaded || (!clientReady && !error);

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
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Shield className="w-10 h-10 text-[#92400E]" />
          </div>
          <h1 className="text-[32px] font-bold text-black mb-2">Verify Your Identity</h1>
          <p className="text-[16px] text-[#666666]">
            Required to access agent profiles and deal rooms.
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
            <Shield className="w-6 h-6 text-[#D4AF37] mx-auto mb-2" />
            <h4 className="font-semibold text-sm">Secure</h4>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
            <CheckCircle className="w-6 h-6 text-[#059669] mx-auto mb-2" />
            <h4 className="font-semibold text-sm">2-3 min</h4>
          </div>
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
            <CheckCircle className="w-6 h-6 text-[#D4AF37] mx-auto mb-2" />
            <h4 className="font-semibold text-sm">One-time</h4>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-[#E5E5E5] p-8 shadow-lg">
          
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-red-800">Error</h4>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
              >
                Refresh Page
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && !error && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-black mb-2">
                Preparing Verification...
              </h3>
              <p className="text-gray-500 text-sm">{debugInfo}</p>
            </div>
          )}

          {/* Ready */}
          {!isLoading && !error && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-12 h-12 text-[#92400E]" />
              </div>
              
              <h3 className="text-2xl font-bold text-black mb-3">Ready to Verify</h3>
              
              <p className="text-gray-600 mb-6">You'll need a government ID and camera access.</p>

              <button
                onClick={handleBeginVerification}
                disabled={launching}
                className="h-14 px-8 rounded-xl bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-bold text-lg disabled:opacity-50 shadow-lg flex items-center justify-center mx-auto"
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

        <p className="text-xs text-gray-400 text-center mt-6">
          Powered by Persona • {debugInfo}
        </p>
      </div>
    </div>
  );
}

export default function Verify() {
  return <VerifyContent />;
}