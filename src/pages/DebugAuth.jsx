import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, RefreshCw, LogOut, ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * Debug Auth Page - for troubleshooting auth/session issues
 * Shows current auth state, session status, cookies, etc.
 */
export default function DebugAuth() {
  const navigate = useNavigate();
  const { loading, user, profile, role, onboarded, kycVerified, refresh } = useCurrentProfile();
  const [sessionData, setSessionData] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [cookies, setCookies] = useState('');

  useEffect(() => {
    checkSession();
    loadCookies();
  }, []);

  const checkSession = async () => {
    setSessionLoading(true);
    try {
      const response = await fetch('/functions/session', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      setSessionData({ status: response.status, data });
    } catch (error) {
      setSessionData({ status: 'error', error: error.message });
    } finally {
      setSessionLoading(false);
    }
  };

  const loadCookies = () => {
    // Mask cookie values for security
    const cookieStr = document.cookie
      .split(';')
      .map(c => {
        const [name, value] = c.trim().split('=');
        const masked = value ? value.substring(0, 8) + '...' : '';
        return `${name}=${masked}`;
      })
      .join('; ');
    setCookies(cookieStr || 'No cookies found');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleSignOut = async () => {
    try {
      await base44.auth.logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      window.location.href = '/';
    }
  };

  const handleHardRefresh = async () => {
    toast.info('Refreshing profile...');
    await refresh();
    await checkSession();
    toast.success('Profile refreshed');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900">Auth Debug Panel</h1>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Debug Mode:</strong> This page is for troubleshooting authentication issues. 
            Remove from production.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Button onClick={handleHardRefresh} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={handleSignOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
          <Button onClick={() => navigate(createPageUrl("PostAuth"))} variant="outline" className="gap-2">
            <ArrowRight className="w-4 h-4" />
            Post-Auth
          </Button>
          <Button onClick={checkSession} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Ping Session
          </Button>
        </div>

        <div className="space-y-4">
          {/* useCurrentProfile State */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">useCurrentProfile()</h3>
              {loading ? (
                <Badge className="bg-yellow-100 text-yellow-800">Loading</Badge>
              ) : user ? (
                <Badge className="bg-emerald-100 text-emerald-800">Authenticated</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Not Authenticated</Badge>
              )}
            </div>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Loading:</span>
                <span className="text-slate-900">{loading.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">User ID:</span>
                <span className="text-slate-900">{user?.id || 'null'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Email:</span>
                <span className="text-slate-900">{user?.email || 'null'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Role:</span>
                <span className="text-slate-900">{role || 'null'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Onboarded:</span>
                <span className="text-slate-900">{onboarded.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">KYC Verified:</span>
                <span className="text-slate-900">{kycVerified.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Profile ID:</span>
                <span className="text-slate-900">{profile?.id || 'null'}</span>
              </div>
            </div>
          </div>

          {/* Session Endpoint Result */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">/functions/session</h3>
              {sessionLoading ? (
                <Badge className="bg-yellow-100 text-yellow-800">Checking...</Badge>
              ) : sessionData?.data?.ok ? (
                <Badge className="bg-emerald-100 text-emerald-800">HTTP {sessionData.status}</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">HTTP {sessionData?.status || '---'}</Badge>
              )}
            </div>
            {sessionData && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-0 right-0"
                  onClick={() => handleCopy(JSON.stringify(sessionData, null, 2))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <pre className="bg-slate-50 rounded-lg p-4 overflow-x-auto text-xs font-mono">
                  {JSON.stringify(sessionData, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Cookies */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">document.cookie (masked)</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(cookies)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
              <code className="text-xs font-mono text-slate-700">{cookies}</code>
            </div>
          </div>

          {/* Environment */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4">Environment</h3>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Location:</span>
                <span className="text-slate-900 text-xs">{window.location.href}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Local Time:</span>
                <span className="text-slate-900">{new Date().toISOString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">User Agent:</span>
                <span className="text-slate-900 text-xs truncate max-w-md">
                  {navigator.userAgent}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}