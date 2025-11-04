import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { AuthGuard } from "@/components/AuthGuard";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyCallbackContent() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking, verified, processing, failed
  const [message, setMessage] = useState('Checking verification status...');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      // Wait a moment for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await base44.functions.invoke('verifyStatus');
      const data = response.data;

      if (!data.ok) {
        throw new Error(data.error || 'Failed to check status');
      }

      if (data.verified) {
        setStatus('verified');
        setMessage('Identity verified successfully!');
        
        // Redirect to dashboard after showing success
        setTimeout(() => {
          navigate(createPageUrl("Dashboard"));
        }, 2000);
      } else if (data.verification_status === 'processing') {
        setStatus('processing');
        setMessage('Verification is still processing...');
        
        // Check again in a few seconds
        setTimeout(checkStatus, 3000);
      } else if (data.verification_status === 'failed') {
        setStatus('failed');
        setMessage('Verification could not be completed');
      } else {
        setStatus('processing');
        setMessage('Processing your verification...');
        
        // Check again
        setTimeout(checkStatus, 3000);
      }

    } catch (error) {
      console.error('[VerifyCallback] Status check error:', error);
      setStatus('failed');
      setMessage('Could not verify status. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          
          {/* Icon */}
          <div className="mb-6">
            {status === 'checking' || status === 'processing' ? (
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
            ) : status === 'verified' ? (
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-white" />
              </div>
            )}
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {status === 'verified' ? 'Verification Complete!' :
             status === 'processing' ? 'Finishing Checks...' :
             status === 'failed' ? 'Verification Failed' :
             'Checking Status...'}
          </h1>
          
          <p className={`mb-6 ${
            status === 'verified' ? 'text-emerald-700' :
            status === 'failed' ? 'text-red-700' :
            'text-slate-600'
          }`}>
            {message}
          </p>

          {/* Actions */}
          {status === 'verified' && (
            <p className="text-sm text-slate-500">
              Redirecting to dashboard...
            </p>
          )}

          {status === 'processing' && (
            <p className="text-sm text-slate-500">
              This may take up to 30 seconds. Please wait...
            </p>
          )}

          {status === 'failed' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 mb-4">
                Your verification could not be completed. This can happen if the ID was unclear or didn't match.
              </p>
              <Button
                onClick={() => navigate(createPageUrl("Verify"))}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(createPageUrl("Dashboard"))}
                className="w-full"
              >
                Back to Dashboard
              </Button>
            </div>
          )}

        </div>

        {/* Help */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Need help?{' '}
            <a href="mailto:support@agentvault.com" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact Support
            </a>
          </p>
        </div>
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