import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";

export default function BillingSuccess() {
  const navigate = useNavigate();
  const { profile, loading } = useCurrentProfile();

  React.useEffect(() => {
    if (!loading && profile) {
      navigate(createPageUrl("IdentityVerification"), { replace: true });
    }
  }, [loading, profile, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#E3C567] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}