import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Clock, Shield } from "lucide-react";

function VerifyCallbackContent() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // 'checking' | 'approved' | 'failed' | 'needs_review' | 'pending'
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 15; // 15 seconds

  useEffect(() => {
    // Read query params from Persona
    const urlParams = new URLSearchParams(window.location.search);
    const inquiryId = urlParams.get('inquiry-id') || urlParams.get('inquiryId');
    const refId = urlParams.get('reference-id');
    const queryStatus = urlParams.get('status');

    console.log('[VerifyCallback] Persona redirect params:', { inquiryId, refId, queryStatus });

    // Start polling
    if (inquiryId) {
      pollKYCStatus(inquiryId);
    } else {
      // No inquiry ID - check current status from profile
      checkCurrentStatus();
    }
  }, []);

  const checkCurrentStatus = async () => {
    try {
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        setStatus('failed');
        return;
      }

      const data = await response.json();
      const profile = data.profile;

      if (!profile) {
        setStatus('failed');
        return;
      }

      handleStatus(profile.kyc_status);
    } catch (error) {
      console.error('[VerifyCallback] Error checking status:', error);
      setStatus('failed');
    }
  };

  const pollKYCStatus = async (inquiryId) => {
    try {
      // Call poll endpoint
      const response = await fetch(`/functions/personaPoll?inquiryId=${inquiryId}`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        console.error('[VerifyCallback] Poll failed:', response.status);
        setStatus('failed');
        return;
      }

      const data = await response.json();
      console.log('[VerifyCallback] Poll result:', data);

      const kycStatus = data.kyc_status;
      
      // Handle final states
      if (kycStatus === 'approved') {
        setStatus('approved');
        setTimeout(() => {
          navigate(createPageUrl("Dashboard"), { replace: true });
        }, 2000);
        return;
      }

      if (kycStatus === 'failed') {
        setStatus('failed');
        return;
      }

      if (kycStatus === 'needs_review') {
        setStatus('needs_review');
        return;
      }

      // Still pending - poll again if under max
      if (pollCount < maxPolls && (kycStatus === 'pending' || kycStatus === 'unverified')) {
        setTimeout(() => {
          setPollCount(pollCount + 1);
          pollKYCStatus(inquiryId);
        }, 1000);
      } else {
        // Timeout - show pending/review state
        setStatus(kycStatus === 'pending' ? 'pending' : 'needs_review');
      }

    } catch (error) {
      console.error('[VerifyCallback] Poll error:', error);
      setStatus('failed');
    }
  };

  const handleStatus = (kycStatus) => {
    switch (kycStatus) {
      case 'approved':
        setStatus('approved');
        setTimeout(() => {
          navigate(createPageUrl("Dashboard"), { replace: true });
        }, 2000);
        break;
      case 'failed':
        setStatus('failed');
        break;
      case 'needs_review':
        setStatus('needs_review');
        break;
      default:
        setStatus('pending');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {status === 'checking' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-slate-200">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Finalizing Verification...</h2>
            <p className="text-slate-600 mb-4">
              We're confirming your identity verification with Persona
            </p>
            <div className="flex justify-center items-center gap-2 text-sm text-slate-500">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span>Checking status ({pollCount}/{maxPolls}s)</span>
            </div>
          </div>
        )}

        {status === 'approved' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-emerald-200">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">Verification Complete!</h2>
            <p className="text-slate-600 mb-4">
              Your identity has been verified successfully
            </p>
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
              <span className="ml-2 text-sm text-slate-600">Redirecting to dashboard...</span>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-900 mb-2">Verification Not Completed</h2>
            <p className="text-slate-600 mb-6">
              We were unable to verify your identity at this time. This may be due to:
            </p>
            <ul className="text-left text-sm text-slate-600 mb-6 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Document quality or readability issues</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Information mismatch or incomplete data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">•</span>
                <span>Session timeout or interruption</span>
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
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}

        {(status === 'needs_review' || status === 'pending') && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg border-2 border-yellow-200">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-900 mb-2">Manual Review Required</h2>
            <p className="text-slate-600 mb-4">
              Your verification is being reviewed by our compliance team. This typically takes 1-2 business days.
            </p>
            <div className="bg-yellow-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-700">
                <strong>What's next?</strong><br />
                You'll receive an email once the review is complete. You can explore public pages in the meantime.
              </p>
            </div>
            <Button 
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Continue to Dashboard
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