import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyStartContent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    redirectToPersona();
  }, []);

  const redirectToPersona = async () => {
    try {
      // Get current user
      const user = await base44.auth.me();
      if (!user) {
        base44.auth.redirectToLogin(window.location.pathname);
        return;
      }

      // Get profile to check status
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      const profile = data.profile;

      if (!profile) {
        setError("Profile not found. Please complete onboarding first.");
        setTimeout(() => navigate(createPageUrl("Onboarding")), 2000);
        return;
      }

      // Check if onboarding is complete
      if (!profile.onboarding_completed_at) {
        setError("Please complete onboarding before verifying your identity.");
        setTimeout(() => navigate(createPageUrl("Onboarding")), 2000);
        return;
      }

      // If already approved, redirect to dashboard
      if (profile.kyc_status === 'approved') {
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }

      // Build Persona hosted flow URL
      const appOrigin = 'https://agent-vault-da3d088b.base44.app';
      const personaEnvId = 'env_JYPpWD9CCQRPNSQ2hy6A26czau5H';
      const personaTemplateId = 'itmpl_S55mLQgAGrNb2VbRzCjKN9xSv6xM';
      const personaBase = 'https://agentvault.withpersona.com/verify';
      
      const url = new URL(personaBase);
      url.searchParams.set('inquiry-template-id', personaTemplateId);
      url.searchParams.set('environment-id', personaEnvId);
      url.searchParams.set('reference-id', user.id);
      url.searchParams.set('redirect-uri', `${appOrigin}${createPageUrl("VerifyCallback")}`);
      
      // Prefill fields
      if (user.email) {
        url.searchParams.set('fields[email]', user.email);
      }
      if (profile.user_role || profile.user_type) {
        url.searchParams.set('fields[role]', profile.user_role || profile.user_type);
      }
      if (profile.full_name) {
        const nameParts = profile.full_name.split(' ');
        if (nameParts.length > 0) {
          url.searchParams.set('fields[name-first]', nameParts[0]);
        }
        if (nameParts.length > 1) {
          url.searchParams.set('fields[name-last]', nameParts.slice(1).join(' '));
        }
      }

      console.log('[VerifyStart] Redirecting to Persona:', url.toString());

      // Update profile to set status to 'pending'
      await base44.functions.invoke('profileUpsert', {
        kyc_status: 'pending',
        kyc_provider: 'persona'
      });

      // Redirect to Persona
      window.location.href = url.toString();

    } catch (err) {
      console.error('[VerifyStart] Error:', err);
      setError(err.message || "Failed to start verification. Please try again.");
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-50 rounded-xl p-8 border-2 border-red-200">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Verification Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <Button 
              onClick={() => navigate(createPageUrl("Dashboard"))}
              variant="outline"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Starting Verification...</h2>
        <p className="text-slate-600">Redirecting you to Persona for identity verification</p>
        <p className="text-xs text-slate-500 mt-2">This may take a few seconds</p>
      </div>
    </div>
  );
}

export default function VerifyStart() {
  return (
    <AuthGuard requireAuth={true}>
      <VerifyStartContent />
    </AuthGuard>
  );
}