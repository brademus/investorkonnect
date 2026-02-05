import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const { profile, loading, refresh } = useCurrentProfile();
  const [hasRefreshed, setHasRefreshed] = useState(false);

  useEffect(() => {
    document.title = "Success - Investor Konnect";
    
    // Clear profile cache to get fresh subscription status
    try {
      sessionStorage.removeItem('profile_cache');
    } catch (_) {}
  }, []);

  // Force refresh profile to get updated subscription status
  useEffect(() => {
    if (!hasRefreshed) {
      setHasRefreshed(true);
      refresh();
    }
  }, [hasRefreshed, refresh]);

  // Auto-redirect to Identity Verification once profile is loaded
  useEffect(() => {
    if (!loading && profile && hasRefreshed) {
      console.log('[BillingSuccess] Auto-redirecting to IdentityVerification');
      navigate(createPageUrl("IdentityVerification"), { replace: true });
    }
  }, [loading, profile, hasRefreshed, navigate]);

  // Always show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E3C567] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}