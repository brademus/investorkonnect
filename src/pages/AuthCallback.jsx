import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

/**
 * Auth Callback - Finalizes OAuth/Magic Link and routes to home or onboarding
 * This is where users land after Google OAuth or clicking a magic link
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [message, setMessage] = useState('Completing sign in...');

  useEffect(() => {
    console.log('[AuthCallback] Starting session finalization...');
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Step 1: Let Base44 process the callback (sets session cookies)
      console.log('[AuthCallback] Processing OAuth/magic link callback...');
      
      // Base44 should automatically handle the callback via URL hash/params
      // Wait a moment for cookies to be set
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Verify session was created
      console.log('[AuthCallback] Checking if session exists...');
      const isAuth = await base44.auth.isAuthenticated();
      
      if (!isAuth) {
        console.error('[AuthCallback] No session found after callback');
        setStatus('error');
        setMessage('Authentication failed. Please try again.');
        
        setTimeout(() => {
          navigate(createPageUrl("Login"), { replace: true });
        }, 2000);
        return;
      }
      
      console.log('[AuthCallback] ✅ Session confirmed, getting user info...');
      
      // Step 3: Get user info and check profile/onboarding status
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      
      const state = await response.json();
      
      console.log('[AuthCallback] User state:', {
        authenticated: state.authenticated,
        email: state.email,
        hasProfile: !!state.profile,
        onboardingCompleted: state.onboarding?.completed,
        needsOnboarding: state.flags?.needsOnboarding
      });
      
      // Step 4: Route based on onboarding status
      const needsOnboarding = state.flags?.needsOnboarding || !state.onboarding?.completed;
      
      setStatus('success');
      
      if (needsOnboarding) {
        console.log('[AuthCallback] → Routing to /onboarding');
        setMessage('Welcome! Let\'s complete your profile...');
        
        setTimeout(() => {
          navigate(createPageUrl("Onboarding"), { replace: true });
        }, 1000);
      } else {
        console.log('[AuthCallback] → Routing to /home');
        setMessage('Welcome back!');
        
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 1000);
      }
      
    } catch (error) {
      console.error('[AuthCallback] Error:', error);
      setStatus('error');
      setMessage('Something went wrong. Redirecting to login...');
      
      setTimeout(() => {
        navigate(createPageUrl("Login"), { replace: true });
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Just a moment...</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Success!</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Oops!</h2>
            <p className="text-slate-600">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}