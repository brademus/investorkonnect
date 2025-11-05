import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Clock, Shield } from "lucide-react";

function VerifyCallbackContent() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'passed' | 'failed' | 'review'
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 20; // 20 seconds

  useEffect(() => {
    // Read query params from Persona
    const urlParams = new URLSearchParams(window.location.search);
    const inquiryId = urlParams.get('inquiry-id');
    const refId = urlParams.get('reference-id');
    const queryStatus = urlParams.get('status');

    console.log('[VerifyCallback] Persona params:', { inquiryId, refId, queryStatus });

    // Start polling for KYC status
    pollKYCStatus();
  }, []);

  const pollKYCStatus = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) {
        navigate(createPageUrl("Home"), { replace: true });
        return;
      }

      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      if (profiles.length === 0) {
        setStatus('failed');
        return;
      }

      const profile = profiles[0];

      console.log('[VerifyCallback] Profile KYC status:', profile.kyc_status);

      // Check status
      if (profile.kyc_status === 'passed') {
        setStatus('passed');
        setTimeout(() => {
          navigate(createPageUrl("Dashboard"), { replace: true });
        }, 2000);
        return;
      }

      if (profile.kyc_status === 'failed') {
        setStatus('failed');
        return;
      }

      if (profile.kyc_status === 'review') {
        setStatus('review');
        return;
      }

      // Still processing - poll again if under max
      if (pollCount < maxPolls) {
        setTimeout(() => {
          setPollCount(pollCount + 1);
          pollKYCStatus();
        }, 1000);
      } else {
        // Timeout - check current status
        if (profile.kyc_status === 'unknown' || profile.kyc_status === 'processing') {
          setStatus('review'); // Treat as manual review needed
        }
      }

    } catch (error) {
      console.error('[VerifyCallback] Poll error:', error);
      setStatus('failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {status === 'verifying' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-slate-200">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verifying Your Identity...</h2>
            <p className="text-slate-600 mb-4">
              Please wait while we confirm your verification with Persona
            </p>
            <div className="flex justify-center items-center gap-2 text-sm text-slate-500">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span>Processing ({pollCount}/{maxPolls}s)</span>
            </div>
          </div>
        )}

        {status === 'passed' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-emerald-200">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">Verification Complete!</h2>
            <p className="text-slate-600 mb-4">
              Your identity has been verified. Redirecting you to dashboard...
            </p>
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-900 mb-2">Verification Failed</h2>
            <p className="text-slate-600 mb-6">
              We were unable to verify your identity. This may be due to:
            </p>
            <ul className="text-left text-sm text-slate-600 mb-6 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Document quality issues</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Information mismatch</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Incomplete verification process</span>
              </li>
            </ul>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => navigate(createPageUrl("VerifyStart"))}
                className="bg-blue-600 hover:bg-blue-700 w-full"
              >
                <Shield className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                onClick={() => navigate(createPageUrl("Dashboard"))}
                variant="outline"
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        )}

        {status === 'review' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-yellow-200">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-900 mb-2">Manual Review Required</h2>
            <p className="text-slate-600 mb-4">
              Your verification is being reviewed by our team. This usually takes 1-2 business days.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              You'll receive an email once the review is complete. You can continue browsing non-protected pages.
            </p>
            <Button 
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyCallback() {
  return (
    <AuthGuard requireAuth={true}>
      <VerifyCallbackContent />
    </AuthGuard>
  );
}