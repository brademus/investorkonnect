import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

/**
 * PostAuth - OAuth callback landing page
 * Handles session verification and routes to dashboard or sign-in
 */
export default function PostAuth() {
  const navigate = useNavigate();
  const { refresh } = useCurrentProfile();
  const [status, setStatus] = useState('checking'); // 'checking' | 'success' | 'failed'
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  useEffect(() => {
    verifySession();
  }, []);

  const verifySession = async () => {
    try {
      setStatus('checking');
      
      // Call session endpoint to verify authentication
      const response = await fetch('/functions/session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.ok && data.authenticated) {
          console.log('[PostAuth] Session verified, hydrating profile...');
          
          // Hydrate profile data
          await refresh();
          
          setStatus('success');
          
          // Route to dashboard after short delay
          setTimeout(() => {
            navigate(createPageUrl("Dashboard"), { replace: true });
          }, 500);
        } else {
          throw new Error('Not authenticated');
        }
      } else {
        throw new Error('Session check failed');
      }
    } catch (error) {
      console.error('[PostAuth] Session verification failed:', error);
      
      // Retry up to maxAttempts
      if (attempts < maxAttempts) {
        console.log(`[PostAuth] Retrying... (${attempts + 1}/${maxAttempts})`);
        setAttempts(attempts + 1);
        setTimeout(() => verifySession(), 1000);
      } else {
        console.log('[PostAuth] Max attempts reached, redirecting to sign-in');
        setStatus('failed');
        
        // Redirect to home (which will show sign-in)
        setTimeout(() => {
          navigate(createPageUrl("Home"), { replace: true });
        }, 2000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="max-w-md w-full text-center p-8">
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Verifying Session...
            </h2>
            <p className="text-slate-600">
              Please wait while we confirm your authentication
            </p>
            {attempts > 0 && (
              <p className="text-sm text-slate-500 mt-2">
                Attempt {attempts}/{maxAttempts}
              </p>
            )}
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Success!
            </h2>
            <p className="text-slate-600">
              Redirecting to your dashboard...
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Session Not Found
            </h2>
            <p className="text-slate-600">
              Redirecting to sign in...
            </p>
          </>
        )}
      </div>
    </div>
  );
}