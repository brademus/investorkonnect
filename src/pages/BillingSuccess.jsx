import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/components/useCurrentProfile";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const { profile, loading } = useCurrentProfile();

  useEffect(() => {
    document.title = "Success - Investor Konnect";
  }, []);

  // Auto-redirect to Identity Verification
  useEffect(() => {
    if (!loading && profile) {
      console.log('[BillingSuccess] Auto-redirecting to IdentityVerification');
      navigate(createPageUrl("IdentityVerification"), { replace: true });
    }
  }, [loading, profile, navigate]);

  // Always show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E3C567] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}