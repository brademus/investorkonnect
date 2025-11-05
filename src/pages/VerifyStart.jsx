import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Loader2, Shield } from "lucide-react";

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

      // Get profile to check if already verified
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (profiles.length === 0) {
        setError("Profile not found. Please complete onboarding first.");
        setTimeout(() => navigate(createPageUrl("Onboarding")), 2000);
        return;
      }

      const profile = profiles[0];

      // If already verified, redirect to dashboard
      if (profile.kyc_verified === true) {
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }

      // Build Persona hosted flow URL
      const personaBase = 'https://agentvault.withpersona.com/verify?inquiry-template-id=itmpl_S55mLQgAGrNb2VbRzCjKN9xSv6xM&environment-id=env_JYPpWD9CCQRPNSQ2hy6A26czau5H';
      const appBaseUrl = 'https://agent-vault-da3d088b.base44.app';
      
      const url = new URL(personaBase);
      url.searchParams.set('reference-id', user.id);
      url.searchParams.set('redirect-uri', `${appBaseUrl}${createPageUrl("VerifyCallback")}`);
      
      // Optional prefill fields
      if (user.email) {
        url.searchParams.set('fields[email]', user.email);
      }
      if (profile.user_role || profile.user_type) {
        url.searchParams.set('fields[role]', profile.user_role || profile.user_type || 'member');
      }

      console.log('[VerifyStart] Redirecting to Persona:', url.toString());

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-50 rounded-xl p-8 border-2 border-red-200">
            <Shield className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Verification Error</h2>
            <p className="text-red-700">{error}</p>
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