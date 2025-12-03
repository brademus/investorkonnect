import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Loader2, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * IDENTITY VERIFICATION PAGE
 * Uses Persona embedded SDK with config from backend secrets
 */
export default function Verify() {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [personaReady, setPersonaReady] = useState(false);
  const [personaConfig, setPersonaConfig] = useState(null);

  // Step 1: Load user, profile, and Persona config
  useEffect(() => {
    const init = async () => {
      try {
        // Get current user
        const currentUser = await base44.auth.me();
        if (!currentUser) {
          base44.auth.redirectToLogin(createPageUrl("Verify"));
          return;
        }
        setUser(currentUser);

        // Get profile
        const profiles = await base44.entities.Profile.filter({ user_id: currentUser.id });
        const currentProfile = profiles[0];
        
        if (!currentProfile) {
          navigate(createPageUrl("RoleSelection"), { replace: true });
          return;
        }

        // Check if already verified
        if (currentProfile.kyc_status === 'approved') {
          navigate(createPageUrl("Dashboard"), { replace: true });
          return;
        }

        // Check if onboarding is complete
        if (!currentProfile.onboarding_completed_at) {
          const role = currentProfile.user_role;
          if (role === 'investor') {
            navigate(createPageUrl("InvestorDeepOnboarding"), { replace: true });
          } else if (role === 'agent') {
            navigate(createPageUrl("AgentDeepOnboarding"), { replace: true });
          } else {
            navigate(createPageUrl("RoleSelection"), { replace: true });
          }
          return;
        }

        setProfile(currentProfile);

        // Get Persona config from backend
        const configResponse = await base44.functions.invoke('personaConfig', {});
        const configData = configResponse.data;
        
        if (configData?.templateId && configData?.environmentId) {
          setPersonaConfig(configData);
        } else {
          throw new Error(configData?.error || 'Failed to load verification config');
        }

        setLoading(false);
      } catch (err) {
        console.error('[Verify] Init error:', err);
        setError(err.message || 'Failed to load. Please refresh.');
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  // Step 2: Load Persona SDK once we have config
  useEffect(() => {
    if (!personaConfig || personaReady) return;

    // Check if already loaded
    if (window.Persona && window.Persona.Client) {
      console.log('[Verify] Persona SDK already available');
      setPersonaReady(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="persona"]');
    if (existingScript) {
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.Persona && window.Persona.Client) {
          clearInterval(checkLoaded);
          setPersonaReady(true);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.0.0.js';
    script.async = true;
    script.onload = () => {
      console.log('[Verify] Persona SDK script loaded');
      // Give it a moment to initialize
      setTimeout(() => {
        if (window.Persona && window.Persona.Client) {
          console.log('[Verify] Persona SDK ready');
          setPersonaReady(true);
        } else {
          console.error('[Verify] Persona SDK loaded but Client not available');
          setError('Verification system failed to initialize. Please refresh.');
        }
      }, 100);
    };
    script.onerror = (e) => {
      console.error('[Verify] Failed to load Persona SDK:', e);
      setError('Failed to load verification system. Please refresh.');
    };
    document.head.appendChild(script);
  }, [personaConfig, personaReady]);

  // Handle verification button click
  const startVerification = () => {
    if (!personaConfig) {
      setError('Verification config not loaded. Please refresh.');
      return;
    }

    // Check if Persona SDK is available
    if (typeof window.Persona === 'undefined' || !window.Persona.Client) {
      setError('Verification system not loaded. Please refresh the page.');
      return;
    }

    setError(null);

    try {
      const client = new window.Persona.Client({
        templateId: personaConfig.templateId,
        environmentId: personaConfig.environmentId,
        referenceId: user.id,
        prefill: {
          emailAddress: user.email,
          nameFirst: profile.full_name?.split(' ')[0] || '',
          nameLast: profile.full_name?.split(' ').slice(1).join(' ') || '',
        },
        onReady: () => {
          console.log('[Verify] Persona client ready, opening modal...');
          client.open();
        },
        onComplete: async ({ inquiryId, status }) => {
          console.log('[Verify] Verification complete:', { inquiryId, status });
          setVerifying(true);

          try {
            await base44.entities.Profile.update(profile.id, {
              kyc_status: status === 'completed' ? 'approved' : 'pending',
              kyc_inquiry_id: inquiryId,
              kyc_provider: 'persona',
              kyc_last_checked: new Date().toISOString(),
            });

            toast.success('Identity verified successfully!');
            navigate(createPageUrl("Dashboard"), { replace: true });
          } catch (err) {
            console.error('[Verify] Profile update failed:', err);
            setError('Verification completed but failed to save. Contact support.');
            setVerifying(false);
          }
        },
        onCancel: () => {
          console.log('[Verify] User cancelled');
        },
        onError: (err) => {
          console.error('[Verify] Persona error:', err);
          setError('Verification failed. Please try again.');
        },
      });
    } catch (err) {
      console.error('[Verify] Failed to create Persona client:', err);
      setError('Failed to start verification. Please refresh.');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  // Verifying state
  if (verifying) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl border p-10 shadow-lg">
          <Loader2 className="w-14 h-14 text-[#D4AF37] animate-spin mx-auto mb-5" />
          <h2 className="text-2xl font-bold mb-2">Processing Verification...</h2>
          <p className="text-gray-500">Please wait while we confirm your identity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="h-16 flex items-center justify-center border-b">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-[#D4AF37] rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold">INVESTOR KONNECT</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-9 h-9 text-amber-700" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Verify Your Identity</h1>
          <p className="text-gray-500">
            Required to access agent profiles and deal rooms
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <Shield className="w-6 h-6 text-[#D4AF37] mx-auto mb-2" />
            <p className="text-sm font-medium">Secure</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium">2-3 min</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-[#D4AF37] mx-auto mb-2" />
            <p className="text-sm font-medium">One-time</p>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl border shadow-sm p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm text-red-600 underline mt-1"
                >
                  Refresh page
                </button>
              </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-gray-600 mb-6">
              You'll need a government-issued ID and camera access.
            </p>

            <button
              onClick={startVerification}
              disabled={!personaReady}
              className="w-full h-14 rounded-xl bg-[#D4AF37] hover:bg-[#C19A2E] text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {!personaReady ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Begin Verification
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          Powered by Persona • Your data is encrypted and secure
        </p>
      </div>
    </div>
  );
}