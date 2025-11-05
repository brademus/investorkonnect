import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

// Environment IDs - safe for client
const ENV_ID = 'env_JYPpWD9CCQRPNSQ2hy6A26czau5H';
const TMPL_ID = 'itmpl_S55mLQgAGrNb2VbRzCjKN9xSv6xM';

// FINAL fallback (hosted) — prevents dead-ends if embedding fails
const HOSTED_FALLBACK = 'https://agentvault.withpersona.com/verify?inquiry-template-id=itmpl_S55mLQgAGrNb2VbRzCjKN9xSv6xM&environment-id=env_JYPpWD9CCQRPNSQ2hy6A26czau5H';

function VerifyContent() {
  const navigate = useNavigate();
  const { loading, user, profile, onboarded, kycStatus } = useCurrentProfile();
  const mountRef = useRef(null);
  const clientRef = useRef(null);
  const initAttempted = useRef(false);
  
  const [phase, setPhase] = useState('idle');
  const [msg, setMsg] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Persona SDK script
  useEffect(() => {
    if (window.Persona) {
      console.log('[Verify] Persona SDK already loaded');
      setScriptLoaded(true);
      return;
    }

    console.log('[Verify] Loading Persona SDK...');
    setPhase('loading-sdk');
    setMsg('Loading Persona SDK...');

    const script = document.createElement('script');
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.1.2.js';
    script.integrity = 'sha384-nuMfOsYXMwp5L13VJicJkSs8tObai/UtHEOg3f7tQuFWU5j6LAewJbjbF5ZkfoDo';
    script.crossOrigin = 'anonymous';
    script.async = true;
    
    script.onload = () => {
      console.log('[Verify] ✅ Persona SDK loaded successfully');
      setScriptLoaded(true);
      setMsg('SDK loaded. Initializing...');
    };
    
    script.onerror = (error) => {
      console.error('[Verify] ❌ Failed to load Persona SDK:', error);
      setPhase('error');
      setMsg('Failed to load verification system. Redirecting to fallback...');
      setTimeout(() => {
        window.location.href = HOSTED_FALLBACK;
      }, 2000);
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize Persona client - CRITICAL FIX: Call render() immediately, not in onReady
  useEffect(() => {
    if (!scriptLoaded || !window.Persona || !mountRef.current || !user || !profile || clientRef.current || initAttempted.current) {
      return;
    }

    if (kycStatus === 'approved') {
      return;
    }

    // Prevent double initialization
    initAttempted.current = true;

    console.log('[Verify] 🚀 Initializing Persona client...');
    setPhase('rendering');
    setMsg('Initializing verification...');

    try {
      // Create the Persona client
      const client = new window.Persona.Client({
        templateId: TMPL_ID,
        environmentId: ENV_ID,
        referenceId: user.id,
        fields: {
          emailAddress: user.email,
          ...(profile.full_name && {
            nameFirst: profile.full_name.split(' ')[0],
            nameLast: profile.full_name.split(' ').slice(1).join(' ')
          })
        },
        onReady: () => {
          console.log('[Verify] ✅ Persona widget ready');
          setPhase('waiting');
          setMsg('Please complete the verification flow in the widget below...');
        },
        onComplete: async ({ inquiryId, status }) => {
          console.log('[Verify] ✅ Verification completed:', { inquiryId, status });
          setPhase('completed');
          setMsg(`Completed inquiry ${inquiryId}. Finalizing...`);
          
          try {
            const response = await base44.functions.invoke('personaFinalize', {
              inquiryId,
              status
            });

            if (response.data?.ok) {
              setMsg('Identity verified! Redirecting to NDA...');
              toast.success('Verification complete!');
              
              setTimeout(() => {
                navigate(createPageUrl("NDA"), { replace: true });
              }, 1500);
            } else {
              throw new Error(response.data?.error || 'Finalization failed');
            }
          } catch (err) {
            console.error('[Verify] ❌ Finalize error:', err);
            setPhase('error');
            setMsg('Could not finalize verification. Please contact support.');
            toast.error('Verification incomplete');
          }
        },
        onCancel: () => {
          console.log('[Verify] ⚠️ User cancelled');
          setMsg('Verification cancelled. You can try again anytime.');
          toast.info('Verification cancelled');
        },
        onError: (error) => {
          console.error('[Verify] ❌ Persona error:', error);
          setPhase('error');
          setMsg(`Error: ${error?.message || 'Unknown error'}. Please try again or contact support.`);
          toast.error('Verification error');
        }
      });

      clientRef.current = client;

      // CRITICAL FIX: Call render() immediately after creating client
      console.log('[Verify] 📺 Calling render() on container...');
      
      // Give the container a moment to be fully mounted
      setTimeout(() => {
        try {
          if (mountRef.current && clientRef.current) {
            clientRef.current.render(mountRef.current);
            console.log('[Verify] ✅ render() called successfully');
            setMsg('Loading verification widget...');
          } else {
            throw new Error('Container or client not available');
          }
        } catch (renderError) {
          console.error('[Verify] ❌ render() failed:', renderError);
          console.log('[Verify] 🔄 Falling back to modal...');
          
          // Fallback to modal
          try {
            clientRef.current.open();
            setMsg('Opening verification in modal...');
          } catch (modalError) {
            console.error('[Verify] ❌ Modal fallback failed:', modalError);
            setPhase('error');
            setMsg('Could not start verification. Redirecting to alternative flow...');
            
            setTimeout(() => {
              window.location.href = HOSTED_FALLBACK;
            }, 2000);
          }
        }
      }, 100);

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
      console.error('[Verify] ❌ Init error:', err);
      setPhase('error');
      setMsg(`Failed to initialize: ${err.message}. Redirecting...`);
      
      setTimeout(() => {
        window.location.href = HOSTED_FALLBACK;
      }, 2000);
    }
  }, [scriptLoaded, user, profile, kycStatus, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in
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

  // Phase-based status colors
  const getStatusColor = () => {
    switch (phase) {
      case 'completed': return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'error': return 'bg-red-50 border-red-200 text-red-900';
      case 'waiting': return 'bg-blue-50 border-blue-200 text-blue-900';
      default: return 'bg-slate-50 border-slate-200 text-slate-900';
    }
  };

  const getStatusIcon = () => {
    switch (phase) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'waiting': return <Shield className="w-5 h-5 text-blue-600" />;
      default: return <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />;
    }
  };

  // Main verification page
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
            This protects investors, agents, and deal flow. Bank-level encryption. One-time, then reusable.
          </p>
        </div>

        {/* Status Display */}
        <div className={`rounded-xl border-2 p-4 mb-6 ${getStatusColor()}`}>
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className="font-semibold">Status: {phase}</p>
              <p className="text-sm mt-1">{msg}</p>
            </div>
          </div>
        </div>

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

        {/* Embedded Persona Container - CRITICAL: Explicit dimensions and styling */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div 
            id="persona-container"
            ref={mountRef} 
            className="w-full"
            style={{ 
              minHeight: '700px',
              height: '700px',
              width: '100%',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {!scriptLoaded && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-600">Loading verification system...</p>
                </div>
              </div>
            )}
            {scriptLoaded && phase === 'rendering' && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-sm text-slate-600">Starting verification widget...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-slate-500 text-center mt-6">
          Verification powered by Persona. Your data is encrypted and never shared with third parties.
        </p>

        {/* Debug: Fallback button if widget doesn't load after 15 seconds */}
        {scriptLoaded && phase === 'rendering' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 mb-3">Widget not loading?</p>
            <Button
              variant="outline"
              onClick={() => window.location.href = HOSTED_FALLBACK}
            >
              Try Alternative Flow
            </Button>
          </div>
        )}
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