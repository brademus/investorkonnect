import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function VerifyContent() {
  const navigate = useNavigate();
  const { loading, user, profile, onboarded, kycStatus } = useCurrentProfile();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const clientRef = useRef(null);

  // Load Persona script
  useEffect(() => {
    // Check if already loaded
    if (window.Persona) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.1.2.js';
    script.integrity = 'sha384-nuMfOsYXMwp5L13VJicJkSs8tObai/UtHEOg3f7tQuFWU5j6LAewJbjbF5ZkfoDo';
    script.crossOrigin = 'anonymous';
    script.async = true;
    
    script.onload = () => {
      console.log('[Verify] Persona script loaded');
      setScriptLoaded(true);
    };
    
    script.onerror = () => {
      console.error('[Verify] Failed to load Persona script');
      setError('Failed to load verification system. Please refresh the page.');
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize embedded Persona client
  useEffect(() => {
    if (!scriptLoaded || !window.Persona || !containerRef.current || !profile || clientRef.current) {
      return;
    }

    // Already verified
    if (kycStatus === 'approved') {
      return;
    }

    console.log('[Verify] Initializing Persona embed...');

    try {
      const client = new window.Persona.Client({
        templateId: 'itmpl_S55mLQgAGrNb2VbRzCjKN9xSv6xM',
        environmentId: 'env_JYPpWD9CCQRPNSQ2hy6A26czau5H',
        referenceId: user.id,
        // Prefill data
        fields: {
          emailAddress: user.email,
          ...(profile.full_name && {
            nameFirst: profile.full_name.split(' ')[0],
            nameLast: profile.full_name.split(' ').slice(1).join(' ')
          })
        },
        onReady: () => {
          console.log('[Verify] Persona ready, rendering embedded...');
          // Render embedded in container (not open modal)
          client.render(containerRef.current);
        },
        onComplete: async ({ inquiryId, status }) => {
          console.log('[Verify] Completed:', inquiryId, status);
          setVerifying(true);
          
          try {
            // Call server to finalize and update profile
            const response = await base44.functions.invoke('personaFinalize', {
              inquiryId,
              status
            });

            if (response.data?.ok) {
              toast.success('Verification complete!');
              // Small delay then navigate to NDA
              setTimeout(() => {
                navigate(createPageUrl("NDA"), { replace: true });
              }, 1500);
            } else {
              throw new Error(response.data?.error || 'Verification failed');
            }
          } catch (err) {
            console.error('[Verify] Finalize error:', err);
            setError(err.message || 'Failed to complete verification');
            setVerifying(false);
          }
        },
        onCancel: () => {
          console.log('[Verify] User cancelled');
          toast.info('Verification cancelled');
        },
        onError: (error) => {
          console.error('[Verify] Persona error:', error);
          setError('Verification error. Please try again.');
        }
      });

      clientRef.current = client;

      return () => {
        if (clientRef.current) {
          try {
            clientRef.current.destroy();
          } catch (e) {
            console.warn('[Verify] Cleanup error:', e);
          }
          clientRef.current = null;
        }
      };
    } catch (err) {
      console.error('[Verify] Init error:', err);
      setError('Failed to initialize verification. Please refresh the page.');
    }
  }, [scriptLoaded, profile, kycStatus, user, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Not signed in (shouldn't happen with AuthGuard, but just in case)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign In Required</h2>
          <p className="text-slate-600 mb-6">Please sign in to verify your identity</p>
          <Button onClick={() => base44.auth.redirectToLogin()}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Not onboarded
  if (!onboarded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete Onboarding First</h2>
          <p className="text-slate-600 mb-6">You need to complete your profile before verifying your identity</p>
          <Button onClick={() => navigate(createPageUrl("Onboarding"))}>
            Complete Onboarding
          </Button>
        </div>
      </div>
    );
  }

  // Already verified
  if (kycStatus === 'approved') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Already Verified ✓</h2>
            <p className="text-slate-600 mb-6">
              Your identity is verified. Continue to sign the NDA to unlock gated features.
            </p>
            <Button 
              onClick={() => navigate(createPageUrl("NDA"))}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continue to NDA
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Verifying (after completion, before redirect)
  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Completing verification...</p>
        </div>
      </div>
    );
  }

  // Main verification page with embedded widget
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Verify Your Identity</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            This protects investors, agents, and deal flow. Your data is encrypted and used only for verification purposes.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">{error}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-2"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <h4 className="font-semibold text-sm text-slate-900 mb-1">Secure & Private</h4>
            <p className="text-xs text-slate-600">Bank-level encryption</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-semibold text-sm text-slate-900 mb-1">Fast & Easy</h4>
            <p className="text-xs text-slate-600">Takes 2-3 minutes</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <h4 className="font-semibold text-sm text-slate-900 mb-1">One-Time Only</h4>
            <p className="text-xs text-slate-600">Verify once, forever</p>
          </div>
        </div>

        {/* Embedded Persona Container */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {!scriptLoaded ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div 
              ref={containerRef} 
              id="persona-container"
              style={{ minHeight: '640px' }}
            />
          )}
        </div>

        {/* Footer Note */}
        <p className="text-xs text-slate-500 text-center mt-6">
          Verification powered by Persona. Your data is encrypted and never shared with third parties.
        </p>
      </div>
    </div>
  );
}

export default function Verify() {
  return (
    <AuthGuard requireAuth={true}>
      <VerifyContent />
    </AuthGuard>
  );
}