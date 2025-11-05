import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_ORIGIN = "https://agent-vault-da3d088b.base44.app";

/**
 * PostAuth - Final session verification and routing
 * Verifies session cookie, hydrates profile, routes to home
 * ROBUST: No loops, clear error states, retry option
 */
export default function PostAuth() {
  const navigate = useNavigate();
  const { refresh } = useCurrentProfile();
  const [status, setStatus] = useState('checking'); // 'checking' | 'success' | 'failed'
  const [error, setError] = useState(null);

  useEffect(() => {
    verifySession();
  }, []);

  const verifySession = async () => {
    try {
      setStatus('checking');
      setError(null);
      
      console.log('[PostAuth] Verifying session cookie...');
      
      // Call session/get to verify authentication
      const response = await fetch(`${APP_ORIGIN}/functions/sessionGet`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      console.log('[PostAuth] Session check status:', response.status);

      if (response.status === 200) {
        const data = await response.json();
        
        if (data.ok && data.authenticated) {
          console.log('[PostAuth] ✅ Session verified for:', data.user?.email);
          
          // Hydrate profile data
          console.log('[PostAuth] Hydrating profile...');
          await refresh();
          
          setStatus('success');
          
          // Route to home after short delay
          setTimeout(() => {
            console.log('[PostAuth] Routing to home...');
            navigate('/', { replace: true });
          }, 500);
        } else {
          throw new Error('Session not authenticated');
        }
      } else {
        throw new Error(`Session check failed with status ${response.status}`);
      }
    } catch (err) {
      console.error('[PostAuth] Session verification failed:', err);
      setError(err.message || 'Unknown error');
      setStatus('failed');
    }
  };

  const handleRetry = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {status === 'checking' && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Verifying Session...
            </h2>
            <p className="text-slate-600">
              Confirming your authentication
            </p>
            <p className="text-xs text-slate-500 mt-4">
              This should only take a moment
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-emerald-200">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">
              Success!
            </h2>
            <p className="text-slate-600">
              Redirecting to your dashboard...
            </p>
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-900 mb-2">
              Session Not Found
            </h2>
            <p className="text-slate-600 mb-2">
              Unable to verify your session
            </p>
            {error && (
              <p className="text-xs text-red-600 mb-4 font-mono bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-700 w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Button 
                onClick={() => navigate(createPageUrl("DebugAuth"))}
                variant="outline"
                className="w-full"
              >
                View Debug Info
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}