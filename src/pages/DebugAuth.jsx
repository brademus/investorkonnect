import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, RefreshCw, LogOut, Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Debug Auth Page - for troubleshooting auth/session issues
 * Access with ?k=dev to bypass protection
 */
export default function DebugAuth() {
  const navigate = useNavigate();
  const { loading, user, profile, role, onboarded, kycStatus, refresh } = useCurrentProfile();
  const [sdkUser, setSdkUser] = useState(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [meData, setMeData] = useState(null);

  useEffect(() => {
    // Check for debug key
    const params = new URLSearchParams(window.location.search);
    if (params.get('k') === 'dev') {
      setAccessGranted(true);
    }
  }, []);

  useEffect(() => {
    if (accessGranted) {
      loadSdkUser();
      loadMeData();
    }
  }, [accessGranted]);

  const loadSdkUser = async () => {
    try {
      const u = await base44.auth.me();
      setSdkUser(u);
    } catch (e) {
      setSdkUser(null);
    }
  };

  const loadMeData = async () => {
    try {
      const response = await fetch('/functions/me', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });
      const data = await response.json();
      setMeData(data);
    } catch (error) {
      setMeData({ error: error.message });
    }
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
    await loadSdkUser();
    await loadMeData();
    toast.success('Profile refreshed');
  };

  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="bg-orange-50 rounded-xl p-8 border-2 border-orange-200">
            <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-orange-900 mb-2">Access Restricted</h2>
            <p className="text-orange-700">
              This debug page requires a special access key
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            Access: ?k=dev
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <Button onClick={handleHardRefresh} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={handleSignOut} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
          <Button onClick={() => base44.auth.redirectToLogin()} variant="outline" className="gap-2">
            Sign In
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
                <span className="text-slate-600">KYC Status:</span>
                <span className="text-slate-900">{kycStatus || 'unverified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Profile ID:</span>
                <span className="text-slate-900">{profile?.id || 'null'}</span>
              </div>
            </div>
          </div>

          {/* SDK User */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">base44.auth.me()</h3>
              {sdkUser ? (
                <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Null</Badge>
              )}
            </div>
            {sdkUser && (
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">ID:</span>
                  <span className="text-slate-900">{sdkUser.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Email:</span>
                  <span className="text-slate-900">{sdkUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Role:</span>
                  <span className="text-slate-900">{sdkUser.role || 'member'}</span>
                </div>
              </div>
            )}
          </div>

          {/* /functions/me Response */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">/functions/me</h3>
              {meData?.authenticated ? (
                <Badge className="bg-emerald-100 text-emerald-800">Authenticated</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">Not Authenticated</Badge>
              )}
            </div>
            {meData && (
              <div className="relative">
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-0 right-0"
                  onClick={() => handleCopy(JSON.stringify(meData, null, 2))}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <pre className="bg-slate-50 rounded-lg p-4 overflow-x-auto text-xs font-mono">
                  {JSON.stringify(meData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}