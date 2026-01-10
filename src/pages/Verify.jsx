import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { Shield, CheckCircle, AlertCircle } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
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

        // Get profile - USE EMAIL AS PRIMARY KEY
        const emailLower = currentUser.email.toLowerCase().trim();
        let profiles = await base44.entities.Profile.filter({ email: emailLower });
        if (!profiles || profiles.length === 0) {
          profiles = await base44.entities.Profile.filter({ user_id: currentUser.id });
        }
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
            // Re-fetch profile to ensure we have latest data - USE EMAIL AS PRIMARY KEY
            const emailLower = user.email.toLowerCase().trim();
            let profiles = await base44.entities.Profile.filter({ email: emailLower });
            if (!profiles || profiles.length === 0) {
              profiles = await base44.entities.Profile.filter({ user_id: user.id });
            }
            let currentProfile = profiles[0];
            
            // If profile doesn't exist, create it
            if (!currentProfile) {
              console.log('[Verify] Profile not found, creating new one for:', emailLower);
              currentProfile = await base44.entities.Profile.create({
                user_id: user.id,
                email: emailLower,
                full_name: user.full_name,
                kyc_status: status === 'completed' ? 'approved' : 'pending',
                kyc_inquiry_id: inquiryId,
                kyc_provider: 'persona',
                kyc_last_checked: new Date().toISOString(),
              });
            } else {
              await base44.entities.Profile.update(currentProfile.id, {
                user_id: user.id, // Ensure user_id is synced
                kyc_status: status === 'completed' ? 'approved' : 'pending',
                kyc_inquiry_id: inquiryId,
                kyc_provider: 'persona',
                kyc_last_checked: new Date().toISOString(),
              });
            }

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
          setError(err?.message || 'Verification failed. Please try again.');
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
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  // Verifying state
  if (verifying) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-[#0D0D0D] rounded-2xl border border-[#1F1F1F] p-10 shadow-lg">
          <LoadingAnimation className="w-64 h-64 mx-auto mb-5" />
          <h2 className="text-2xl font-bold mb-2 text-[#FAFAFA]">Processing Verification...</h2>
          <p className="text-[#808080]">Please wait while we confirm your identity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="h-16 flex items-center justify-center border-b border-[#1F1F1F]">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-[#E3C567] rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <span className="text-lg font-bold text-[#E3C567]">INVESTOR KONNECT</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E3C567]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-9 h-9 text-[#E3C567]" />
          </div>
          <h1 className="text-3xl font-bold mb-2 text-[#E3C567]">Verify Your Identity</h1>
          <p className="text-[#808080]">
            Required to access agent profiles and deal rooms
          </p>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <Shield className="w-6 h-6 text-[#E3C567] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#FAFAFA]">Secure</p>
          </div>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-[#34D399] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#FAFAFA]">2-3 min</p>
          </div>
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-[#E3C567] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#FAFAFA]">One-time</p>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-[#0D0D0D] rounded-2xl border border-[#1F1F1F] shadow-sm p-8">
          {error && (
            <div className="bg-[#DC2626]/20 border border-[#DC2626]/30 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-[#FAFAFA]">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm text-[#DC2626] underline mt-1"
                >
                  Refresh page
                </button>
              </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-[#808080] mb-6">
              You'll need a government-issued ID and camera access.
            </p>

            <button
              onClick={startVerification}
              disabled={!personaReady}
              className="w-full h-14 rounded-xl bg-[#E3C567] hover:bg-[#EDD89F] text-black font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {!personaReady ? (
                <>
                  <LoadingAnimation className="w-5 h-5" />
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

        <p className="text-xs text-[#666666] text-center mt-6">
          Powered by Persona • Your data is encrypted and secure
        </p>
      </div>
    </div>
  );
}