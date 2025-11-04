import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

const PUBLIC_APP_URL = "https://agent-vault-da3d088b.base44.app";

/**
 * Logout Page
 * Signs user out and redirects to home
 */
export default function Logout() {
  useEffect(() => {
    handleLogout();
  }, []);

  const handleLogout = async () => {
    console.log('[Logout] Signing out...');
    
    try {
      await base44.auth.signOut();
      console.log('[Logout] Sign out complete');
    } catch (error) {
      console.error('[Logout] Sign out error:', error);
    }
    
    // Always redirect to home after logout
    console.log('[Logout] Redirecting to home...');
    window.location.replace(`${PUBLIC_APP_URL}/`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Signing you out...</p>
      </div>
    </div>
  );
}