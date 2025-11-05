import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_ORIGIN = "https://agent-vault-da3d088b.base44.app";

/**
 * AuthCallback - OAuth callback handler
 * Exchanges auth code for session, sets cookie, then routes to post-auth
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('exchanging'); // 'exchanging' | 'setting_cookie' | 'success' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('[AuthCallback] Step 1: Exchanging code for session...');
      setStatus('exchanging');

      // CRITICAL: Exchange the OAuth code/magic link token for a Base44 session
      // This is handled automatically by Base44 SDK when the callback page loads
      // The SDK should have already set auth tokens in memory/storage
      
      // Verify we have a session now
      const isAuth = await base44.auth.isAuthenticated();
      
      if (!isAuth) {
        throw new Error('Session exchange failed - not authenticated after callback');
      }

      const user = await base44.auth.me();
      console.log('[AuthCallback] ✅ Session exchanged successfully for:', user?.email);

      console.log('[AuthCallback] Step 2: Setting session cookie...');
      setStatus('setting_cookie');

      // Set the session cookie with proper attributes for Safari/iOS
      const cookieResponse = await fetch(`${APP_ORIGIN}/functions/sessionSet`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!cookieResponse.ok) {
        console.warn('[AuthCallback] Cookie set returned:', cookieResponse.status);
        // Continue anyway - cookie might already be set by Base44
      } else {
        console.log('[AuthCallback] ✅ Session cookie set');
      }

      setStatus('success');
      
      // Small delay to ensure cookie is persisted
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('[AuthCallback] Step 3: Redirecting to post-auth...');
      
      // Route to post-auth for final verification
      navigate(createPageUrl("PostAuth"), { replace: true });

    } catch (err) {
      console.error('[AuthCallback] Error:', err);
      setError(err.message || 'Authentication failed');
      setStatus('error');
    }
  };

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 rounded-xl p-8 border-2 border-red-200">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-900 mb-2">Authentication Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 hover:bg-blue-700 w-full"
              >
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
        
        {status === 'exchanging' && (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Completing Sign In...
            </h2>
            <p className="text-slate-600">
              Step 1/3: Exchanging credentials
            </p>
          </>
        )}
        
        {status === 'setting_cookie' && (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Securing Session...
            </h2>
            <p className="text-slate-600">
              Step 2/3: Setting secure cookie
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Almost There...
            </h2>
            <p className="text-slate-600">
              Step 3/3: Verifying session
            </p>
          </>
        )}

        <p className="text-xs text-slate-500 mt-4">
          Please do not close this window
        </p>
      </div>
    </div>
  );
}