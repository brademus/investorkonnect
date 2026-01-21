import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ExternalLink, AlertCircle } from "lucide-react";

export default function IdentityVerification() {
  const navigate = useNavigate();
  const { loading, user, profile } = useCurrentProfile();
  const [personaUrl, setPersonaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const startVerification = async () => {
    if (!profile?.id) return;
    setStarting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("personaStart", { profile_id: profile.id });
      const url = res?.data?.persona_url;
      if (url) {
        setPersonaUrl(url);
        // Redirect to Persona hosted flow
        window.location.href = url;
      } else {
        setError("Could not generate verification link.");
        setStarting(false);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Failed to start verification.";
      setError(msg);
      setStarting(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(createPageUrl("Home"), { replace: true });
      return;
    }
    if (profile?.id) {
      startVerification();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
        <div className="text-center">
          <LoadingAnimation className="w-48 h-48 mx-auto mb-4" />
          <p className="text-[#808080]">Preparing verification…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 text-center">
        <div className="w-14 h-14 bg-[#E3C567] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-black" />
        </div>
        <h1 className="text-2xl font-bold text-[#E3C567] mb-2">Identity Verification</h1>
        <p className="text-sm text-[#808080] mb-6">
          You’ll be redirected to our secure provider to complete verification.
        </p>

        {error ? (
          <div className="bg-red-900/20 border border-red-900/40 text-red-300 rounded-xl p-3 mb-4 text-left flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">{error}</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center mb-4">
              {starting ? (
                <LoadingAnimation className="w-24 h-24" />
              ) : (
                <p className="text-xs text-[#808080]">Redirecting… If nothing happens, use the button below.</p>
              )}
            </div>
            {personaUrl && (
              <Button
                onClick={() => (window.location.href = personaUrl)}
                className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
              >
                Continue to Verification <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate(createPageUrl("PostAuth"), { replace: true })}
          >
            Back
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={startVerification}
            disabled={starting}
          >
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}