import React, { useEffect, useRef } from "react";
import { createPageUrl } from "@/components/utils";

export default function BillingSuccess() {
  const hasRedirected = useRef(false);

  useEffect(() => {
    document.title = "Success - Investor Konnect";
    
    // Clear profile cache to get fresh subscription status
    try {
      sessionStorage.removeItem('profile_cache');
    } catch (_) {}
    
    // Redirect immediately - no need to wait for profile
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      console.log('[BillingSuccess] Redirecting to IdentityVerification');
      // Use window.location for clean navigation with cleared cache
      window.location.href = createPageUrl("IdentityVerification");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#E3C567] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#E3C567]">Payment successful! Redirecting...</p>
      </div>
    </div>
  );
}