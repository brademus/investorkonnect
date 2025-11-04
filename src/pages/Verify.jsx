import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, Loader2, AlertTriangle, HelpCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function VerifyContent() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refresh } = useCurrentProfile();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // Refresh profile on mount to get latest verification status
    if (!profileLoading) {
      refresh();
    }
  }, []);

  const handleStartVerification = async () => {
    setStarting(true);
    
    try {
      const response = await base44.functions.invoke('verifyCreateSession');
      const data = response.data;

      if (!data.ok) {
        throw new Error(data.error || 'Failed to start verification');
      }

      if (data.already_verified) {
        toast.success("You're already verified!");
        navigate(createPageUrl("Dashboard"));
        return;
      }

      // Redirect to Stripe hosted verification
      window.location.href = data.url;

    } catch (error) {
      console.error('[Verify] Start error:', error);
      toast.error(error.message || "Failed to start verification");
      setStarting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const isVerified = profile?.verified === true;
  const verificationStatus = profile?.verification_status || 'requires_verification';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${
            isVerified ? 'bg-emerald-600' : 'bg-blue-600'
          }`}>
            {isVerified ? (
              <CheckCircle className="w-10 h-10 text-white" />
            ) : (
              <Shield className="w-10 h-10 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {isVerified ? 'Identity Verified' : 'Identity Verification'}
          </h1>
          <p className="text-slate-600">
            {isVerified 
              ? "Your identity has been successfully verified" 
              : "Verify your identity to access protected features"}
          </p>
        </div>

        {/* Status Card */}
        {isVerified ? (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 mb-8">
            <div className="flex items-start gap-4">
              <CheckCircle className="w-8 h-8 text-emerald-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-emerald-900 text-xl mb-2">Verified ✅</h3>
                <p className="text-emerald-800 mb-1">
                  Your identity has been verified using Stripe Identity.
                </p>
                {profile?.verified_at && (
                  <p className="text-sm text-emerald-700">
                    Verified on {new Date(profile.verified_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6">
              <Button 
                onClick={() => navigate(createPageUrl("Dashboard"))}
                className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-8">
            {/* Why Verify Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Why We Verify Identity</h2>
              <div className="space-y-3 text-slate-700">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>Protects all users from fraud and fake accounts</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>Required before accessing NDAs and deal rooms</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>Builds trust between investors and agents</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>One-time process - takes less than 5 minutes</p>
                </div>
              </div>
            </div>

            {/* What You Need */}
            <div className="bg-blue-50 rounded-xl p-6 mb-8 border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-3">What You'll Need</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• A government-issued photo ID (driver's license or passport)</li>
                <li>• Access to your device's camera for selfie verification</li>
                <li>• About 3-5 minutes to complete the process</li>
              </ul>
            </div>

            {/* Failed Status */}
            {verificationStatus === 'failed' && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-orange-900 mb-2">Previous Verification Failed</h3>
                    <p className="text-orange-800 text-sm mb-3">
                      Your previous verification attempt couldn't be completed. This can happen if:
                    </p>
                    <ul className="text-sm text-orange-700 space-y-1 mb-3">
                      <li>• The ID image was unclear or cut off</li>
                      <li>• The selfie didn't match the ID photo</li>
                      <li>• Information on the ID couldn't be read</li>
                    </ul>
                    <p className="text-sm text-orange-800">
                      Please try again with a clear, well-lit photo of your ID.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Start Button */}
            <Button
              onClick={handleStartVerification}
              disabled={starting}
              className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-semibold"
            >
              {starting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting Verification...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Start Identity Verification
                </>
              )}
            </Button>

            {/* Security Note */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600 mb-2">
                🔒 Powered by <strong>Stripe Identity</strong> - Bank-level security
              </p>
              <p className="text-xs text-slate-500">
                Your data is encrypted and never stored by AgentVault
              </p>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-slate-600" />
            <h3 className="font-bold text-slate-900">Need Help?</h3>
          </div>
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <strong>Having trouble?</strong> Make sure you're in a well-lit area and your ID is clearly visible.
            </p>
            <p>
              <strong>Questions about verification?</strong> Contact us at{' '}
              <a href="mailto:support@agentvault.com" className="text-blue-600 hover:text-blue-700 font-medium">
                support@agentvault.com
              </a>
            </p>
            <p>
              <strong>Privacy concerns?</strong> Read our{' '}
              <a 
                href={createPageUrl("PrivacyPolicy")} 
                target="_blank"
                className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                Privacy Policy <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

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