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

      console.log('[VerifyStart] User:', user.email);

      // Get profile
      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      
      if (!profiles || profiles.length === 0) {
        console.error('[VerifyStart] No profile found for user:', user.id);
        setError("Profile not found. Please complete onboarding first.");
        setTimeout(() => navigate(createPageUrl("Onboarding")), 2000);
        return;
      }

      const profile = profiles[0];
      console.log('[VerifyStart] Profile loaded:', {
        id: profile.id,
        email: profile.email,
        onboarded: !!profile.onboarding_completed_at,
        kyc_status: profile.kyc_status
      });

      // Check if onboarding is complete
      if (!profile.onboarding_completed_at) {
        setError("Please complete onboarding before verifying your identity.");
        setTimeout(() => navigate(createPageUrl("Onboarding")), 2000);
        return;
      }

      // If already approved, redirect to dashboard
      if (profile.kyc_status === 'approved') {
        console.log('[VerifyStart] Already verified, redirecting to dashboard');
        navigate(createPageUrl("Dashboard"), { replace: true });
        return;
      }

      // Call backend to get Persona URL (backend will use secrets)
      console.log('[VerifyStart] Calling backend to generate Persona URL...');
      
      const response = await base44.functions.invoke('personaStart', {
        user_id: user.id,
        profile_id: profile.id
      });

      if (!response.data || !response.data.persona_url) {
        throw new Error(response.data?.error || 'Failed to generate verification URL');
      }

      const personaUrl = response.data.persona_url;
      console.log('[VerifyStart] Got Persona URL, redirecting...');

      // Update profile to pending
      await base44.entities.Profile.update(profile.id, {
        kyc_status: 'pending',
        kyc_provider: 'persona'
      });

      // Redirect to Persona
      window.location.href = personaUrl;

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