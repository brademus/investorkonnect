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

  // Load Persona script
  useEffect(() => {
    if (window.Persona) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.withpersona.com/dist/persona-v5.1.2.js';
    script.integrity = 'sha384-nuMfOsYXMwp5L13VJicJkSs8tObai/UtHEOg3f7tQuFWU5j6LAewJbjbF5ZkfoDo';
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      console.log('[Verify] ✅ Persona loaded');
      setScriptLoaded(true);
    };
    
    script.onerror = () => {
      console.error('[Verify] ❌ Failed to load Persona');
      toast.error('Failed to load verification system');
    };

    document.body.appendChild(script);
  }, []);

  // Initialize Persona IMMEDIATELY when script loads
  useEffect(() => {
    if (!scriptLoaded || !window.Persona || !user) return;
    if (kycStatus === 'approved') return;

    console.log('[Verify] 🚀 Creating Persona client...');

    const client = new window.Persona.Client({
      templateId: 'itmpl_S55mLQgAGrNb2VbRzCjKN9xSv6xM',
      environmentId: 'env_JYPpWD9CCQRPNSQ2hy6A26czau5H',
      referenceId: user.id,
      onComplete: async ({ inquiryId, status }) => {
        console.log(`[Verify] ✅ Completed: ${inquiryId}`);
        
        try {
          const response = await base44.functions.invoke('personaFinalize', {
            inquiryId,
            status
          });

          if (response.data?.ok) {
            toast.success('Verification complete!');
            setTimeout(() => {
              navigate(createPageUrl("NDA"), { replace: true });
            }, 1500);
          }
        } catch (err) {
          console.error('[Verify] ❌ Finalize error:', err);
          toast.error('Could not finalize verification');
        }
      },
      onCancel: () => {
        console.log('[Verify] ⚠️ Cancelled');
        toast.info('Verification cancelled');
      },
      onError: (error) => {
        console.error('[Verify] ❌ Error:', error);
        toast.error('Verification error');
      }
    });

    // CRITICAL: Call render with the ID selector
    console.log('[Verify] 📺 Calling render...');
    client.render('#persona-container');
    console.log('[Verify] ✅ Render called');

  }, [scriptLoaded, user, kycStatus, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign In Required</h2>
          <p className="text-slate-600 mb-6">Please sign in to verify your identity</p>
          <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete Onboarding First</h2>
          <p className="text-slate-600 mb-6">Please complete your profile before verifying</p>
          <Button onClick={() => navigate(createPageUrl("Onboarding"))}>Complete Onboarding</Button>
        </div>
      </div>
    );
  }

  if (kycStatus === 'approved') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Already Verified ✓</h2>
            <p className="text-slate-600 mb-6">Continue to sign the NDA to unlock features.</p>
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

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Verify Your Identity</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Bank-level encryption. One-time verification.
          </p>
        </div>

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

        {/* Persona Container */}
        <div className="bg-white rounded-xl border-2 border-slate-300 shadow-lg overflow-hidden">
          <div 
            id="persona-container"
            style={{ 
              minHeight: '600px',
              width: '100%'
            }}
          />
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          Powered by Persona. Your data is encrypted and never shared.
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